import crypto from "node:crypto";
import validator from "validator";
import { config } from "../../config.js";
import { badRequest, forbidden, notFound } from "../../lib/errors.js";
import { sendMail } from "../../lib/mailer.js";
import { Invite, isInviteUsable, type InviteDoc, type InviteRole } from "../../models/invite.js";
import { Membership } from "../../models/membership.js";
import { User, type UserDoc } from "../../models/user.js";
import { Workspace } from "../../models/workspace.js";
import type { WorkspaceContext } from "../workspaces/workspaces.service.js";
import { auditService } from "../audit/audit.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const inviteUrl = (token: string) => `${config.APP_URL.replace(/\/$/, "")}/invite/${token}`;

const present = (invite: InviteDoc) => ({
  _id: invite._id.toString(),
  url: inviteUrl(invite.token),
  role: invite.role,
  email: invite.email ?? null,
  expiresAt: invite.expiresAt,
  maxUses: invite.maxUses ?? null,
  uses: invite.uses,
  createdAt: invite.createdAt,
});

export interface CreateInviteInput {
  role: InviteRole;
  email?: string;
  expiresInDays: number;
  maxUses?: number;
}

export const invitesService = {
  async create(ctx: WorkspaceContext, input: CreateInviteInput) {
    if (input.role === "admin" && ctx.membership.role !== "owner") {
      throw forbidden("Only the owner can invite admins");
    }

    if (input.email) {
      const existing = await User.findOne({ email: input.email }).select("_id");
      if (existing && (await Membership.exists({ workspaceId: ctx.workspace._id, userId: existing._id }))) {
        throw badRequest("That person is already in this workspace");
      }
    }

    const invite = await Invite.create({
      token: crypto.randomBytes(24).toString("base64url"),
      workspaceId: ctx.workspace._id,
      role: input.role,
      email: input.email,
      createdBy: ctx.user._id,
      expiresAt: new Date(Date.now() + input.expiresInDays * DAY_MS),
      // An email invite is for one person.
      maxUses: input.email ? 1 : input.maxUses,
    });

    auditService.record(
      ctx,
      "invite.created",
      { type: "invite", id: invite._id.toString(), label: input.email ?? "Invite link" },
      { role: input.role, expiresInDays: input.expiresInDays, ...(input.maxUses && !input.email ? { maxUses: input.maxUses } : {}) },
    );

    if (input.email) {
      const url = inviteUrl(invite.token);
      const ws = validator.escape(ctx.workspace.name);
      const who = validator.escape(ctx.user.fullName);
      await sendMail({
        to: input.email,
        subject: `${ctx.user.fullName} invited you to ${ctx.workspace.name} on Project Teams`,
        text: `${ctx.user.fullName} invited you to join "${ctx.workspace.name}" on Project Teams.\n\nJoin here: ${url}\n\nThis invite expires in ${input.expiresInDays} days.`,
        html: `<p>${who} invited you to join <strong>${ws}</strong> on Project Teams.</p><p><a href="${url}">Join ${ws}</a></p><p>This invite expires in ${input.expiresInDays} days.</p>`,
      });
    }

    return present(invite);
  },

  async listActive(ctx: WorkspaceContext) {
    const invites = await Invite.find({
      workspaceId: ctx.workspace._id,
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });
    return invites.filter((i) => isInviteUsable(i)).map(present);
  },

  async revoke(ctx: WorkspaceContext, inviteId: string) {
    const invite = await Invite.findOne({ _id: inviteId, workspaceId: ctx.workspace._id });
    if (!invite) throw notFound("Invite not found");
    invite.revokedAt = new Date();
    await invite.save();
    auditService.record(ctx, "invite.revoked", { type: "invite", id: invite._id.toString(), label: invite.email ?? "Invite link" });
  },

  /** Public preview for the invite page. Reveals only what the invitee needs to decide. */
  async preview(token: string) {
    const invite = await Invite.findOne({ token });
    if (!invite || !isInviteUsable(invite)) throw notFound("This invite link is invalid or has expired");
    const [workspace, inviter, memberCount] = await Promise.all([
      Workspace.findById(invite.workspaceId).select("name"),
      User.findById(invite.createdBy).select("fullName"),
      Membership.countDocuments({ workspaceId: invite.workspaceId }),
    ]);
    if (!workspace) throw notFound("This invite link is invalid or has expired");
    return {
      workspace: { name: workspace.name, memberCount },
      invitedBy: inviter?.fullName ?? null,
      role: invite.role,
      emailRestricted: Boolean(invite.email),
    };
  },

  /** Joins the workspace (or just switches to it if already a member). */
  async accept(user: UserDoc, token: string, ip?: string) {
    const invite = await Invite.findOne({ token });
    if (!invite || !isInviteUsable(invite)) throw notFound("This invite link is invalid or has expired");
    if (invite.email && invite.email !== user.email) {
      throw forbidden(`This invite was sent to a different email address. Sign in as ${maskEmail(invite.email)} to accept it.`);
    }

    const already = await Membership.exists({ workspaceId: invite.workspaceId, userId: user._id });
    if (!already) {
      // Count the use atomically so a link can't be used past maxUses by racing requests.
      const claimed = await Invite.findOneAndUpdate(
        {
          _id: invite._id,
          revokedAt: { $exists: false },
          expiresAt: { $gt: new Date() },
          $or: [{ maxUses: { $exists: false } }, { $expr: { $lt: ["$uses", "$maxUses"] } }],
        },
        { $inc: { uses: 1 } },
      );
      if (!claimed) throw notFound("This invite link is invalid or has expired");
      await Membership.updateOne(
        { workspaceId: invite.workspaceId, userId: user._id },
        { $setOnInsert: { role: invite.role } },
        { upsert: true },
      );
      auditService.recordFor(
        invite.workspaceId,
        user,
        "member.joined",
        { type: "member", id: user._id.toString(), label: `${user.fullName} (${user.email})` },
        { role: invite.role, via: invite.email ? "email invite" : "invite link" },
        ip,
      );
    }

    user.activeWorkspaceId = invite.workspaceId;
    await User.updateOne({ _id: user._id }, { $set: { activeWorkspaceId: invite.workspaceId } });
    const workspace = await Workspace.findById(invite.workspaceId).select("name");
    return { workspace: { _id: invite.workspaceId.toString(), name: workspace?.name ?? "" }, alreadyMember: Boolean(already) };
  },
};

/** "jane.doe@example.com" -> "ja•••@example.com" */
export const maskEmail = (email: string) => {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}•••@${domain}`;
};
