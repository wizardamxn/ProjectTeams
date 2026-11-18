import { logger } from "../../lib/logger.js";
import { Chat } from "../../models/chat.js";
import { Document } from "../../models/document.js";
import { Membership } from "../../models/membership.js";
import { RagChunk } from "../../models/ragChunk.js";
import { RagDocument } from "../../models/ragDocument.js";
import { User } from "../../models/user.js";
import { Workspace, type WorkspaceDoc } from "../../models/workspace.js";

/**
 * Turns one legacy 8-digit team code into a real workspace:
 * - creates the workspace (named "Team <code>"; the owner can rename it),
 * - makes the earliest user the owner and everyone else a member,
 * - re-keys that team's docs, files, chunks and chats to the workspace id.
 *
 * Safe to run any number of times (and concurrently): every step is an upsert
 * or only touches rows that still carry the old code.
 */
export const migrateLegacyTeam = async (teamCode: string): Promise<WorkspaceDoc | null> => {
  const users = await User.find({ teamCode }).sort({ createdAt: 1 }).select("_id activeWorkspaceId");
  const founder = users[0];
  if (!founder) return null;

  let workspace = await Workspace.findOne({ legacyTeamCode: teamCode });
  if (!workspace) {
    try {
      workspace = await Workspace.create({ name: `Team ${teamCode}`, createdBy: founder._id, legacyTeamCode: teamCode });
    } catch (err) {
      // Another request migrated the same team at the same moment.
      if ((err as { code?: number }).code !== 11000) throw err;
      workspace = await Workspace.findOne({ legacyTeamCode: teamCode });
      if (!workspace) throw err;
    }
  }
  const workspaceId = workspace._id;
  const key = workspaceId.toString();

  await Membership.bulkWrite(
    users.map((u, i) => ({
      updateOne: {
        filter: { workspaceId, userId: u._id },
        update: { $setOnInsert: { role: i === 0 ? "owner" : "member" } },
        upsert: true,
      },
    })),
  );

  await User.updateMany(
    { teamCode, activeWorkspaceId: { $exists: false } },
    { $set: { activeWorkspaceId: workspaceId } },
  );

  const [docs, files, chunks, chats] = await Promise.all([
    Document.updateMany({ teamId: teamCode }, { $set: { teamId: key } }),
    RagDocument.updateMany({ teamId: teamCode }, { $set: { teamId: key } }),
    RagChunk.updateMany({ teamId: teamCode }, { $set: { teamId: key } }),
    Chat.updateMany(
      { workspaceId: { $exists: false }, participants: { $in: users.map((u) => u._id) } },
      { $set: { workspaceId } },
    ),
  ]);

  logger.info(
    {
      teamCode,
      workspaceId: key,
      members: users.length,
      docs: docs.modifiedCount,
      files: files.modifiedCount,
      chunks: chunks.modifiedCount,
      chats: chats.modifiedCount,
    },
    "Migrated legacy team to workspace",
  );
  return workspace;
};

/** Migrates every legacy team code still in the database. */
export const migrateAllLegacyTeams = async () => {
  const codes: string[] = await User.distinct("teamCode", {
    teamCode: { $exists: true, $ne: null },
    activeWorkspaceId: { $exists: false },
  });
  for (const code of codes) await migrateLegacyTeam(code);
  return codes.length;
};
