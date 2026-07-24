import User from "../models/User.js";
import { getOrCreateFreePlan } from "../utils/plans.js";
import { verifyAccessToken } from "../utils/authTokens.js";
import { isUserId } from "../utils/validation.js";

export const protect = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: "Not authenticated, no token" });
    }

    const decoded = verifyAccessToken(token);
    if (!isUserId(decoded.id)) {
      return res.status(401).json({ success: false, message: "Not authenticated, token failed" });
    }
    req.userId = decoded.id;
    req.sessionId = decoded.sid;
    next();
  } catch (error) {
    console.warn("Authentication failed:", error.message);
    res.status(401).json({ success: false, message: "Not authenticated, token failed" });
  }
};

export const attachDbUser = async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Not authenticated" });

    let user = await User.findById(req.userId).populate("plan");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found in database" });
    }

    // Older users may predate plans. Assigning Free here prevents missing plans
    // from accidentally bypassing feature and quota checks.
    if (!user.plan) {
      const freePlan = await getOrCreateFreePlan();
      user.plan = freePlan._id;
      await user.save();
      user = await User.findById(req.userId).populate("plan");
    }

    req.dbUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!req.dbUser) {
      return res.status(500).json({ success: false, message: "User context not attached" });
    }

    if (req.dbUser.role === 'superadmin') {
       return next();
    }

    if (!roles.includes(req.dbUser.role)) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not have the required role to access this." });
    }
    
    next();
  };
};
