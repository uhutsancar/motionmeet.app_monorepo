import Plan from "../models/Plan.js";
import User from "../models/User.js";

export const getActivePlansList = async () => {
  return await Plan.find({ isActive: true }).sort({ price: 1 });
};

export const getPlanById = async (planId) => {
  return await Plan.findById(planId);
};

export const updateUserPlan = async (userId, planId) => {
  return await User.findByIdAndUpdate(
    userId,
    { plan: planId },
    { new: true }
  ).populate("plan");
};
