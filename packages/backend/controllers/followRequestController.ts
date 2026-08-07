import type { RequestHandler } from "express";
import * as relationshipService from "../services/relationshipService.js";
import * as userService from "../services/userService.js";
import { parsePagination } from "../utils/pagination.js";
import { isUserId } from "../utils/validation.js";

/**
 * Follows an open account outright and opens a request against a private one.
 * The target's own privacy setting decides which, so tapping Follow can never
 * hand out access to a locked account's posts or stories.
 */
const FOLLOW_MESSAGES: Record<relationshipService.FollowAction, string> = {
  followed: "You are now following this user",
  requested: "Follow request sent",
  already_requested: "Follow request already sent",
  already_following: "You already follow this user",
};

export const sendFollowRequest: RequestHandler = async (req, res, next) => {
  try {
    const targetId = req.body?.id ?? req.body?.userId;
    if (!(await userService.validateTargetUser(req.userId, targetId, "allowFollowers"))) {
      return res.status(403).json({ success: false, message: "This user does not accept followers" });
    }
    const action = await relationshipService.requestFollow(req.userId, targetId as string);
    const relationship = await relationshipService.getRelationshipState(req.userId, targetId as string);
    return res.json({ success: true, action, relationship, message: FOLLOW_MESSAGES[action] });
  } catch (error) {
    return next(error);
  }
};

export const cancelFollowRequest: RequestHandler = async (req, res, next) => {
  try {
    const targetId = req.params.targetId;
    if (!isUserId(targetId) || targetId === req.userId) {
      return res.status(400).json({ success: false, message: "Invalid user" });
    }
    const cancelled = await relationshipService.cancelFollowRequest(req.userId, targetId);
    if (!cancelled) return res.status(404).json({ success: false, message: "Follow request not found" });
    return res.json({ success: true, relationship: await relationshipService.getRelationshipState(req.userId, targetId), message: "Follow request withdrawn" });
  } catch (error) {
    return next(error);
  }
};

export const acceptFollowRequest: RequestHandler = async (req, res, next) => {
  try {
    const requesterId = req.params.requesterId ?? req.body?.id;
    if (!isUserId(requesterId) || requesterId === req.userId) {
      return res.status(400).json({ success: false, message: "Invalid user" });
    }
    const accepted = await relationshipService.acceptFollowRequest(req.userId, requesterId);
    if (!accepted) return res.status(404).json({ success: false, message: "Follow request not found" });
    return res.json({ success: true, relationship: await relationshipService.getRelationshipState(req.userId, requesterId), message: "Follow request accepted" });
  } catch (error) {
    return next(error);
  }
};

export const declineFollowRequest: RequestHandler = async (req, res, next) => {
  try {
    const requesterId = req.params.requesterId ?? req.body?.id;
    if (!isUserId(requesterId) || requesterId === req.userId) {
      return res.status(400).json({ success: false, message: "Invalid user" });
    }
    const declined = await relationshipService.declineFollowRequest(req.userId, requesterId);
    if (!declined) return res.status(404).json({ success: false, message: "Follow request not found" });
    return res.json({ success: true, relationship: await relationshipService.getRelationshipState(req.userId, requesterId), message: "Follow request declined" });
  } catch (error) {
    return next(error);
  }
};

const listRequests = (direction: "incoming" | "outgoing"): RequestHandler => async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 30, maxLimit: 50 });
    const page = direction === "incoming"
      ? await relationshipService.getIncomingRequests(req.userId, pagination.limit, pagination.cursor)
      : await relationshipService.getOutgoingRequests(req.userId, pagination.limit, pagination.cursor);
    return res.json({ success: true, ...page });
  } catch (error) {
    return next(error);
  }
};

export const getIncomingFollowRequests = listRequests("incoming");
export const getOutgoingFollowRequests = listRequests("outgoing");

export const getRelationship: RequestHandler = async (req, res, next) => {
  try {
    const targetId = req.params.userId;
    if (!isUserId(targetId)) return res.status(400).json({ success: false, message: "Invalid user" });
    return res.json({ success: true, relationship: await relationshipService.getRelationshipState(req.userId, targetId) });
  } catch (error) {
    return next(error);
  }
};
