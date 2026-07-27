import Plan from "../models/Plan.js";
import User from "../models/User.js";

export const getActivePlansList = async () => {
  return await Plan.find({ isActive: true }).sort({ displayOrder: 1, price: 1 });
};

export const getPlanById = async (planId) => {
  return await Plan.findById(planId);
};


/**
 * Kullanıcının planını günceller ve abonelik durumunu ayarlar.
 * @param {string} userId
 * @param {string} planId
 * @param {{ status?: string, startDate?: Date, endDate?: Date }} [options]
 */
export const updateUserPlan = async (userId, planId, options = {}) => {
  const plan = await Plan.findById(planId);
  if (!plan) return null;

  const isFreePlan = plan.slug === "free" || plan.price === 0;
  const status = options.status ?? (isFreePlan ? "free" : "active");

  const updateFields = {
    plan: planId,
    planStatus: status,
    planStartDate: isFreePlan ? null : (options.startDate ?? new Date()),
    planEndDate:   options.endDate ?? null,
    planCancelledAt: status === "cancelled" ? new Date() : null,
  };

  return await User.findByIdAndUpdate(userId, updateFields, { new: true }).populate("plan");
};
