import crypto from "node:crypto";
import { database, withTransaction } from "../configs/database.js";
import { serializeUser, type InternalUser } from "../repositories/entities.js";

export const getUserByEmailOrUsername = async (email: string, username: string): Promise<InternalUser | null> => {
  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedUsername = String(username).trim().toLowerCase();
  const row = await database.selectFrom("users").selectAll().where((expression) =>
    expression.or([expression("email", "=", normalizedEmail), expression("username", "=", normalizedUsername)]),
  ).executeTakeFirst();
  return row ? serializeUser(row) : null;
};

export const getUserByEmailWithPassword = async (email: string): Promise<InternalUser | null> => {
  const row = await database.selectFrom("users").selectAll().where("email", "=", String(email).trim().toLowerCase()).executeTakeFirst();
  return row ? serializeUser(row, true) : null;
};

export const createUser = async (
  email: string,
  hashedPassword: string,
  fullName: string,
  username: string,
): Promise<InternalUser> => {
  const created = await database.insertInto("users").values({
    email, password_hash: hashedPassword, full_name: fullName, username,
    role: "user", legacy_mongo_id: null,
  }).returningAll().executeTakeFirstOrThrow();
  return serializeUser(created);
};

const hashResetToken = (token: string): string => crypto.createHash("sha256").update(token).digest("hex");

export const createPasswordResetToken = async (userId: string): Promise<string> => {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  await withTransaction(async (transaction) => {
    await transaction.deleteFrom("password_reset_tokens").where("user_id", "=", userId).where("consumed_at", "is", null).execute();
    await transaction.insertInto("password_reset_tokens").values({
      legacy_mongo_id: null, user_id: userId, token_hash: hashResetToken(rawToken),
      expires_at: new Date(Date.now() + 30 * 60 * 1000), consumed_at: null,
    }).execute();
  });
  return rawToken;
};

export const resetPasswordWithToken = async (rawToken: unknown, hashedPassword: string): Promise<boolean> => {
  if (typeof rawToken !== "string" || rawToken.length < 32 || rawToken.length > 256) return false;
  return withTransaction(async (transaction) => {
    const token = await transaction.updateTable("password_reset_tokens").set({ consumed_at: new Date() })
      .where("token_hash", "=", hashResetToken(rawToken)).where("consumed_at", "is", null).where("expires_at", ">", new Date())
      .returning("user_id").executeTakeFirst();
    if (!token) return false;
    const user = await transaction.updateTable("users").set({ password_hash: hashedPassword }).where("id", "=", token.user_id).executeTakeFirst();
    if (Number(user.numUpdatedRows) !== 1) throw new Error("Password reset user no longer exists");
    await transaction.updateTable("sessions").set({ revoked_at: new Date() }).where("user_id", "=", token.user_id).where("revoked_at", "is", null).execute();
    return true;
  });
};
