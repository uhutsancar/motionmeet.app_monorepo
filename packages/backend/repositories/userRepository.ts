import { database, type DatabaseTransaction } from "../configs/database.js";
import { serializeUser, type InternalUser } from "./entities.js";

type Executor = typeof database | DatabaseTransaction;

export const findUserById = async (
  id: string,
  options: { sensitive?: boolean; executor?: Executor } = {},
): Promise<InternalUser | null> => {
  const executor = options.executor ?? database;
  const row = await executor.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirst();
  if (!row) return null;
  return serializeUser(row, options.sensitive ?? false);
};
