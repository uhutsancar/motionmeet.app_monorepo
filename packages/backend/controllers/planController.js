import Plan from "../models/Plan.js";
import User from "../models/User.js";

export const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ price: 1 });
    res.status(200).json({ success: true, plans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMyPlan = async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = await Plan.findById(planId);
    
    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { plan: plan._id },
      { new: true }
    ).populate("plan");

    res.status(200).json({ success: true, message: "Plan updated successfully", user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
