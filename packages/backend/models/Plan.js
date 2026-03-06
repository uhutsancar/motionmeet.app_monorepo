import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      enum: ["Free", "Pro", "Premium"],
      unique: true,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      default: "TRY",
    },
    features: {
      max_workouts_per_month: { type: Number, default: 5 }, // -1 for unlimited
      max_routines: { type: Number, default: 2 },
      can_message_anyone: { type: Boolean, default: false },
      premium_content_access: { type: Boolean, default: false },
      ad_free: { type: Boolean, default: false },
      priority_support: { type: Boolean, default: false },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Plan = mongoose.model("Plan", planSchema);

export default Plan;
