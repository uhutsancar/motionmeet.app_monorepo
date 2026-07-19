import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as authService from "../services/authService.js";
import * as userService from "../services/userService.js";

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  });
};

export const registerUser = async (req, res) => {
  try {
    const { email, password, full_name, username } = req.body;

    if (!email || !password || !full_name || !username) {
      return res.status(400).json({ success: false, message: "Please fill all fields" });
    }

    // Check if user exists
    const userExists = await authService.getUserByEmailOrUsername(email, username);
    if (userExists) {
      return res.status(400).json({ success: false, message: "Email or Username already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await authService.createUser(email, hashedPassword, full_name, username);

    if (user) {
      const token = generateToken(user._id);
      
      res.status(201).json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          full_name: user.full_name,
          profile_picture: user.profile_picture,
        },
        token,
      });
    } else {
      res.status(400).json({ success: false, message: "Invalid user data" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Please provide email and password" });
    }

    const user = await authService.getUserByEmailWithPassword(email);

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        full_name: user.full_name,
        profile_picture: user.profile_picture,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await userService.getUserById(req.userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        full_name: user.full_name,
        profile_picture: user.profile_picture,
        plan: user.plan,
        bio: user.bio
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
