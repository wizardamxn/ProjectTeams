import type { Types } from "mongoose";
import { badRequest, forbidden, notFound } from "../../lib/errors.js";
import { Membership, type MembershipDoc, type Role } from "../../models/membership.js";
import { User, type UserDoc } from "../../models/user.js";
import { Workspace, type WorkspaceDoc } from "../../models/workspace.js";
import { migrateLegacyTeam } from "./legacyMigration.js";
import { auditService } from "../audit/audit.service.js";

/** Everything a request needs to know about where the user is working. */
export interface WorkspaceContext {
  user: UserDoc;
  workspace: WorkspaceDoc;
  membership: MembershipDoc;
  /** The workspace id as stored on docs, files and chunks (`teamId`). */
  key: string;
  /** Client IP of the current request, for the audit log. */
  ip?: string;
}

const toContext = (user: UserDoc, workspace: WorkspaceDoc, membership: MembershipDoc): WorkspaceContext => ({
  user,
  workspace,
  membership,
  key: workspace._id.toString(),
});

const setActive = async (user: UserDoc, workspaceId: Types.ObjectId | undefined) => {
  user.activeWorkspaceId = workspaceId;
  await User.updateOne(
    { _id: user._id },
    workspaceId ? { $set: { activeWorkspaceId: workspaceId } } : { $unset: { activeWorkspaceId: 1 } },
  );
};

/** "Name (email)" for the audit log. */
const memberLabel = async (userId: Types.ObjectId) => {
  const u = await User.findById(userId).select("fullName email").lean();
  return u ? `${u.fullName} (${u.email})` : "Unknown user";
};

export const workspacesService = {
  /**
   * The workspace the user is currently in, or null if they have none yet.
   * Migrates a legacy team code on first use, and falls back to another of the
   * user's workspaces if they were removed from the active one.
   */
  async resolveActive(user: UserDoc): Promise<WorkspaceContext | null> {
    if (!user.activeWorkspaceId && user.teamCode) {
      const migrated = await migrateLegacyTeam(user.teamCode);
      if (migrated) user.activeWorkspaceId = migrated._id;
    }

    if (user.activeWorkspaceId) {
      const [membership, workspace] = await Promise.all([
        Membership.findOne({ workspaceId: user.activeWorkspaceId, userId: user._id }),
        Workspace.findById(user.activeWorkspaceId),
      ]);
      if (membership && workspace) return toContext(user, workspace, membership);
    }

    const fallback = await Membership.findOne({ userId: user._id }).sort({ updatedAt: -1 });
    const workspace = fallback && (await Workspace.findById(fallback.workspaceId));
    await setActive(user, workspace ? workspace._id : undefined);
    return fallback && workspace ? toContext(user, workspace, fallback) : null;
  },

  async listForUser(user: UserDoc) {
    const memberships = await Membership.find({ userId: user._id }).lean();
    const workspaces = await Workspace.find({ _id: { $in: memberships.map((m) => m.workspaceId) } })
      .select("name")
      .lean();
    const roleOf = new Map(memberships.map((m) => [m.workspaceId.toString(), m.role]));
    return workspaces
      .map((w) => ({ _id: w._id.toString(), name: w.name, role: roleOf.get(w._id.toString())! }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async create(user: UserDoc, name: string) {
    const workspace = await Workspace.create({ name, createdBy: user._id });
    await Membership.create({ workspaceId: workspace._id, userId: user._id, role: "owner" });
    await setActive(user, workspace._id);
    return workspace;
  },

  async switchTo(user: UserDoc, workspaceId: string) {
    const membership = await Membership.findOne({ workspaceId, userId: user._id });
    if (!membership) throw notFound("Workspace not found");
    await setActive(user, membership.workspaceId);
  },

  async rename(ctx: WorkspaceContext, name: string) {
    const from = ctx.workspace.name;
    ctx.workspace.name = name;
    const saved = await ctx.workspace.save();
    if (from !== name) auditService.record(ctx, "workspace.renamed", { type: "workspace", id: ctx.key, label: name }, { from, to: name });
    return saved;
  },

  async listMembers(ctx: WorkspaceContext) {
    const memberships = await Membership.find({ workspaceId: ctx.workspace._id }).lean();
    const users = await User.find({ _id: { $in: memberships.map((m) => m.userId) } })
      .select("fullName email avatarUrl")
      .lean();
    const byId = new Map(users.map((u) => [u._id.toString(), u]));
    return memberships
      .flatMap((m) => {
        const u = byId.get(m.userId.toString());
        return u
          ? [{ _id: u._id.toString(), fullName: u.fullName, email: u.email, avatarUrl: u.avatarUrl, role: m.role, joinedAt: m.createdAt }]
          : [];
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  },

  /**
   * Only the owner changes roles. Making someone "owner" transfers ownership:
   * they become owner and the current owner becomes an admin.
   */
  async changeRole(ctx: WorkspaceContext, targetUserId: string, role: Role) {
    if (ctx.membership.role !== "owner") throw forbidden("Only the owner can change roles");
    if (targetUserId === ctx.user._id.toString()) throw badRequest("You can't change your own role");

    const target = await Membership.findOne({ workspaceId: ctx.workspace._id, userId: targetUserId });
    if (!target) throw notFound("Member not found");
    const from = target.role;
    const who = await memberLabel(target.userId);

    if (role === "owner") {
      target.role = "owner";
      ctx.membership.role = "admin";
      await target.save();
      await ctx.membership.save();
      auditService.record(ctx, "ownership.transferred", { type: "member", id: targetUserId, label: who });
    } else {
      target.role = role;
      await target.save();
      if (from !== role) auditService.record(ctx, "member.role_changed", { type: "member", id: targetUserId, label: who }, { from, to: role });
    }
    return target;
  },

  /** Owner can remove anyone else; admins can remove members only. */
  async removeMember(ctx: WorkspaceContext, targetUserId: string) {
    if (targetUserId === ctx.user._id.toString()) throw badRequest("Use 'leave workspace' to remove yourself");
    const target = await Membership.findOne({ workspaceId: ctx.workspace._id, userId: targetUserId });
    if (!target) throw notFound("Member not found");

    const allowed =
      ctx.membership.role === "owner" || (ctx.membership.role === "admin" && target.role === "member");
    if (!allowed) throw forbidden("You can't remove this member");

    await target.deleteOne();
    auditService.record(ctx, "member.removed", { type: "member", id: targetUserId, label: await memberLabel(target.userId) }, { role: target.role });
  },

  async leave(ctx: WorkspaceContext) {
    if (ctx.membership.role === "owner") {
      throw badRequest("Make someone else the owner before you leave");
    }
    await ctx.membership.deleteOne();
    await setActive(ctx.user, undefined);
    auditService.record(ctx, "member.left", { type: "member", id: ctx.user._id.toString(), label: ctx.user.fullName });
  },

  /** True if both users belong to the context's workspace. Used for DMs. */
  async findMember(ctx: WorkspaceContext, userId: unknown) {
    if (typeof userId !== "string" || !/^[a-f0-9]{24}$/i.test(userId)) return null;
    const m = await Membership.exists({ workspaceId: ctx.workspace._id, userId });
    if (!m) return null;
    return User.findById(userId).select("_id fullName");
  },
};
