import { database } from "../configs/database.js";
import { findPlanById, findUserById } from "../repositories/userRepository.js";
import { serializePlan, type InternalPlan, type InternalUser } from "../repositories/entities.js";

export const getActivePlansList = async (): Promise<InternalPlan[]> => {
  const rows = await database.selectFrom("plans").selectAll().where("is_active", "=", true).orderBy("display_order").orderBy("price").execute();
  const cycles = rows.length ? await database.selectFrom("plan_billing_cycles").selectAll().where("plan_id", "in", rows.map((row) => row.id)).execute() : [];
  return rows.map((row) => serializePlan(row, cycles.filter((cycle) => cycle.plan_id === row.id)));
};

export const getPlanById = (planId: string): Promise<InternalPlan | null> => findPlanById(planId);

export interface PlanUpdateOptions {
  status?: "free" | "active" | "trialing" | "cancelled" | "expired";
  startDate?: Date;
  endDate?: Date;
}

export const updateUserPlan = async (userId: string, planId: string, options: PlanUpdateOptions = {}): Promise<InternalUser | null> => {
  const plan = await findPlanById(planId);
  if (!plan) return null;
  const free = plan.slug === "free" || plan.price === 0;
  const status = options.status ?? (free ? "free" : "active");
  await database.updateTable("users").set({
    plan_id: planId, plan_status: status, plan_start_date: free ? null : options.startDate ?? new Date(),
    plan_end_date: options.endDate ?? null, plan_cancelled_at: status === "cancelled" ? new Date() : null,
  }).where("id", "=", userId).execute();
  return findUserById(userId, { plan: true });
};
