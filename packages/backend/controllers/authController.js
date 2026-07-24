import bcrypt from "bcryptjs";
import * as authService from "../services/authService.js";
import * as userService from "../services/userService.js";
import {
  clearRefreshCookie,
  createRefreshSession,
  getRefreshTokenFromRequest,
  isMobileAuthClient,
  isMobileRefreshClient,
  revokeRefreshSession,
  rotateRefreshSession,
  setRefreshCookie,
  signAccessToken,
} from "../utils/authTokens.js";
import {
  validateLogin,
  validateRegistration,
} from "../utils/authValidation.js";

const publicUser = (user) => ({
  id: user._id,
  email: user.email,
  username: user.username,
  full_name: user.full_name,
  profile_picture: user.profile_picture,
  plan: user.plan,
  bio: user.bio,
  privacy: user.privacy,
});

const sendAuthResponse = async (req, res, user, status = 200) => {
  const refreshToken = await createRefreshSession(user._id.toString(), req);
  const sessionId = refreshToken.slice(0, refreshToken.indexOf("."));
  const access = signAccessToken(user._id.toString(), sessionId);
  const mobileClient = isMobileAuthClient(req);

  if (!mobileClient) setRefreshCookie(res, refreshToken);

  return res.status(status).json({
    success: true,
    user: publicUser(user),
    token: access.token,
    accessTokenExpiresAt: access.expiresAt,
    ...(mobileClient ? { refreshToken } : {}),
  });
};

export const registerUser = async (req, res, next) => {
  try {
    const { fieldErrors, normalized } = validateRegistration(req.body);
    if (Object.keys(fieldErrors).length > 0) {
      const error = Object.assign(new Error("Invalid registration data"), {
        status: 400,
        fieldErrors,
      });
      return next(error);
    }

    const userExists = await authService.getUserByEmailOrUsername(
      normalized.email,
      normalized.username
    );
    if (userExists) {
      return res.status(409).json({
        success: false,
        message: "Email or username already exists",
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(normalized.password, salt);
    const user = await authService.createUser(
      normalized.email,
      hashedPassword,
      normalized.full_name,
      normalized.username
    );

    return sendAuthResponse(req, res, user, 201);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email or username already exists",
      });
    }
    return next(error);
  }
};

export const loginUser = async (req, res, next) => {
  try {
    const { email, password, valid } = validateLogin(req.body);
    if (!valid) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const user = await authService.getUserByEmailWithPassword(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    return sendAuthResponse(req, res, user);
  } catch (error) {
    return next(error);
  }
};

export const refreshSession = async (req, res, next) => {
  try {
    const rawToken = getRefreshTokenFromRequest(req);
    const rotated = await rotateRefreshSession(rawToken, req);
    if (!rotated) {
      return res.status(401).json({ success: false, message: "Session expired" });
    }

    const user = await userService.getUserById(rotated.userId);
    if (!user) {
      await revokeRefreshSession(rotated.refreshToken);
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, message: "Session expired" });
    }

    const access = signAccessToken(rotated.userId, rotated.sessionId);
    const mobileClient = isMobileRefreshClient(req);
    if (!mobileClient) setRefreshCookie(res, rotated.refreshToken);

    return res.json({
      success: true,
      user: publicUser(user),
      token: access.token,
      accessTokenExpiresAt: access.expiresAt,
      ...(mobileClient ? { refreshToken: rotated.refreshToken } : {}),
    });
  } catch (error) {
    return next(error);
  }
};

export const logoutUser = async (req, res, next) => {
  try {
    await revokeRefreshSession(getRefreshTokenFromRequest(req));
    clearRefreshCookie(res);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
};
