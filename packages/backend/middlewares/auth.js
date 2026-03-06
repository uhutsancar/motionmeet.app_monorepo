export const protect = async (req, res, next) => {
  try {
    const { userId } = await req.auth();
    if (!userId) {
      return res.status(401).json({ success: false, message: "not authenticated" });
    }
    
    // Attach Clerk userId to request
    req.userId = userId;
    
    // We could populate full user here, but we will do it via a separate middleware or inside controllers
    // if we need full DB access in every protected route. Let's create an attachDbUser middleware.
    
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: error.message });
  }
};

export const attachDbUser = async (req, res, next) => {
  try {
    // Requires protect to be run first
    if (!req.userId) return res.status(401).json({ success: false, message: "Not authenticated" });
    
    const User = (await import("../models/User.js")).default;
    const Plan = (await import("../models/Plan.js")).default;
    
    const user = await User.findById(req.userId).populate("plan");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found in database" });
    }
    
    req.dbUser = user;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const authorizeRole = (...roles) => {
  return (req, res, next) => {
    // Requires attachDbUser to be run first
    if (!req.dbUser) {
      return res.status(500).json({ success: false, message: "User context not attached" });
    }

    // Superadmin bypasses role checks
    if (req.dbUser.role === 'superadmin') {
       return next();
    }

    if (!roles.includes(req.dbUser.role)) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not have the required role to access this." });
    }
    
    next();
  };
};

export const authorizeFeature = (featureKey) => {
  return (req, res, next) => {
    // Requires attachDbUser to be run first
    if (!req.dbUser) {
      return res.status(500).json({ success: false, message: "User context not attached" });
    }

    // Superadmin bypasses feature checks
    if (req.dbUser.role === 'superadmin') {
       return next();
    }

    const userPlan = req.dbUser.plan;
    if (!userPlan || !userPlan.features) {
        return res.status(403).json({ success: false, message: "Forbidden: No valid plan found. Please upgrade your plan." });
    }

    const featureValue = userPlan.features[featureKey];
    
    // For boolean features (e.g. can_message_anyone)
    if (typeof featureValue === "boolean") {
        if (!featureValue) {
             return res.status(403).json({ success: false, message: `Forbidden: Your plan does not support ${featureKey}. Please upgrade.` });
        }
    }
    
    // For numerical limits (e.g. max_workouts_per_month), the controller will handle the decrement/check logic
    // but this middleware just ensures the key exists.
    if (featureValue === undefined) {
         return res.status(403).json({ success: false, message: `Forbidden: Feature ${featureKey} not available in your plan.` });
    }

    next();
  };
};
