import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../configs/database.js";
import { ensureApplicationData } from "../services/bootstrapService.js";
try { await connectDatabase(); await ensureApplicationData(); console.log("Master data seeding completed."); }
catch (error: unknown) { console.error("Master data seed failed:", error instanceof Error ? error.message : error); process.exitCode = 1; }
finally { await disconnectDatabase(); }
