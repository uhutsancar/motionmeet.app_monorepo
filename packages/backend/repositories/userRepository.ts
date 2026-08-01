import { database, type DatabaseTransaction } from "../configs/database.js";
import { serializePlan, serializeUser, type InternalPlan, type InternalUser } from "./entities.js";

type Executor = typeof database | DatabaseTransaction;

export const findPlanById = async (id: string | null, executor: Executor = database): Promise<InternalPlan | null> => {
  if (!id) return null;
  const row = await executor.selectFrom("plans").selectAll().where("id", "=", id).executeTakeFirst();
  if (!row) return null;
  const cycles = await executor.selectFrom("plan_billing_cycles").selectAll().where("plan_id", "=", id).orderBy("interval").execute();
  return serializePlan(row, cycles);
};

export const findUserById = async (
  id: string,
  options: { sensitive?: boolean; plan?: boolean; executor?: Executor } = {},
): Promise<InternalUser | null> => {
  const executor = options.executor ?? database;
  const row = await executor.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirst();
  if (!row) return null;
  const plan = options.plan === false ? null : await findPlanById(row.plan_id, executor);
  return serializeUser(row, plan, options.sensitive ?? false);
};

export const publicUserColumns = [
  "id", "full_name", "username", "profile_picture_url",
] as const;
