import express from "express";
import { database } from "../configs/database.js";
import { attachDbUser, authorizeRole, protect } from "../middlewares/auth.js";
import { serializeUser } from "../repositories/entities.js";
import { parsePagination } from "../utils/pagination.js";
import { isUserId } from "../utils/validation.js";

const router = express.Router();
router.use(protect, attachDbUser, authorizeRole("superadmin"));

router.get("/users", async (request, response, next) => {
  try {
    const pagination = parsePagination(request.query);
    let query = database.selectFrom("users").selectAll();
    if (pagination.cursor) query = query.where((expression) => expression.or([expression("created_at", "<", pagination.cursor!.date), expression.and([expression("created_at", "=", pagination.cursor!.date), expression("id", "<", pagination.cursor!.id)])]));
    const rows = await query.orderBy("created_at", "desc").orderBy("id", "desc").limit(pagination.limit + 1).execute();
    const hasMore = rows.length > pagination.limit; const selected = hasMore ? rows.slice(0, pagination.limit) : rows; const users = selected.map((row) => serializeUser(row)); const last = selected.at(-1);
    response.json({ success: true, users, nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ date: new Date(last.created_at).toISOString(), id: last.id })).toString("base64url") : null });
  } catch (error: unknown) { next(error); }
});

router.put("/users/:id/role", async (request, response, next) => {
  try {
    const body = request.body as Record<string, unknown>; const role = body.role;
    if (!isUserId(request.params.id) || (role !== "user" && role !== "admin" && role !== "superadmin")) return void response.status(400).json({ success: false, message: "Invalid role" });
    if (request.params.id === request.userId && role !== "superadmin") return void response.status(400).json({ success: false, message: "You cannot remove your own superadmin role" });
    const updated = await database.updateTable("users").set({ role }).where("id", "=", request.params.id).returningAll().executeTakeFirst();
    if (!updated) return void response.status(404).json({ success: false, message: "User not found" });
    response.json({ success: true, user: serializeUser(updated) });
  } catch (error: unknown) { next(error); }
});

export default router;
