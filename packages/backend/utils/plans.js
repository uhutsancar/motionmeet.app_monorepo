import Plan from "../models/Plan.js";

const FREE_PLAN_DEFAULTS = {
  name: "Free",
  price: 0,
  currency: "TRY",
  features: {
    max_workouts_per_month: 5,
    max_routines: 2,
    can_message_anyone: false,
    premium_content_access: false,
    ad_free: false,
    priority_support: false,
  },
  isActive: true,
};

export const getOrCreateFreePlan = () =>
  Plan.findOneAndUpdate(
    { name: "Free" },
    { $setOnInsert: FREE_PLAN_DEFAULTS },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

