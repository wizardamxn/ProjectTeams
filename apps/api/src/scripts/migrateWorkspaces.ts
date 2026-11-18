// One-off: convert every legacy team code into a workspace.
// Optional — the API also migrates a team the first time one of its members
// signs in — but running it once after deploying Phase 3 does it up front.
//
//   npm run migrate:workspaces            (from apps/api, after `npm run build`)
import { connectDB, disconnectDB } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { migrateAllLegacyTeams } from "../modules/workspaces/legacyMigration.js";

await connectDB();
const count = await migrateAllLegacyTeams();
logger.info(`Migrated ${count} legacy team(s)`);
await disconnectDB();
