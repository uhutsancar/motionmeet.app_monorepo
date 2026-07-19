import { isObjectId } from "../utils/validation.js";
import * as planService from "../services/planService.js";

export const getPlans = async (req, res, next) => {
  try {
    const plans = await planService.getActivePlansList();
    res.status(200).json({ success: true, plans });
  } catch (error) {
    next(error);
  }
};

export const updateMyPlan = async (req, res, next) => {
  try {
    const { planId } = req.body || {};
    if (!isObjectId(planId)) {
      return res.status(400).json({ success: false, message: "Invalid plan id" });
    }

    const plan = await planService.getPlanById(planId);
    
    if (!plan || !plan.isActive) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }

    if (plan.name !== "Free" || plan.price > 0) {
      return res.status(409).json({
        success: false,
        message: "Paid plan activation requires a verified checkout",
      });
    }

    const user = await planService.updateUserPlan(req.userId, plan._id);

    res.status(200).json({ success: true, message: "Plan updated successfully", user });
  } catch (error) {
    next(error);
  }
};
