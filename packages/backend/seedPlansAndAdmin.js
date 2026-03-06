import mongoose from "mongoose";
import "dotenv/config";
import connectDB from "./configs/db.js";
import Plan from "./models/Plan.js";
import User from "./models/User.js";

const seedData = async () => {
  try {
    await connectDB();

    console.log("Seeding Plans...");
    
    const plans = [
      {
        name: "Free",
        price: 0,
        features: {
          max_workouts_per_month: 5,
          max_routines: 2,
          can_message_anyone: false,
          premium_content_access: false,
          ad_free: false,
          priority_support: false,
        }
      },
      {
        name: "Pro",
        price: 9.99,
        features: {
          max_workouts_per_month: 20,
          max_routines: 10,
          can_message_anyone: true,
          premium_content_access: true,
          ad_free: true,
          priority_support: false,
        }
      },
      {
        name: "Premium",
        price: 19.99,
        features: {
          max_workouts_per_month: -1, // unlimited
          max_routines: -1, // unlimited
          can_message_anyone: true,
          premium_content_access: true,
          ad_free: true,
          priority_support: true,
        }
      }
    ];

    for (const planData of plans) {
      await Plan.findOneAndUpdate({ name: planData.name }, planData, { upsert: true, new: true });
    }
    
    console.log("Plans seeded successfully.");

    console.log("Setting uhutsancar (or first user) as superadmin...");
    
    // Find uhutsancar or the first user in the DB
    let superAdminUser = await User.findOne({ username: "uhutsancar" });
    
    // Fallback to the first user if uhutsancar doesn't exist yet
    if (!superAdminUser) {
        superAdminUser = await User.findOne();
    }
    
    if (superAdminUser) {
        // Also assign the Premium plan to superadmin by default
        const premiumPlan = await Plan.findOne({ name: "Premium" });
        await User.findByIdAndUpdate(superAdminUser._id, { role: "superadmin", plan: premiumPlan._id });
        console.log(`Successfully upgraded user ${superAdminUser.username} to SuperAdmin with Premium plan.`);
    } else {
        console.log("No users found in the database. SuperAdmin not set.");
    }

    mongoose.disconnect();
    console.log("Seeding completed.");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
};

seedData();
