import type { RequestHandler } from "express";
import * as notificationService from "../services/notificationService.js";
import { parsePagination } from "../utils/pagination.js";

export const getNotifications: RequestHandler = async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 30, maxLimit: 50 });
    const page = await notificationService.getNotificationsPage(req.userId, pagination);
    return res.json({ success: true, ...page });
  } catch (error) {
    return next(error);
  }
};

export const getUnreadCount: RequestHandler = async (req, res, next) => {
  try {
    return res.json({ success: true, unreadCount: await notificationService.countUnread(req.userId) });
  } catch (error) {
    return next(error);
  }
};

export const markNotificationsRead: RequestHandler = async (req, res, next) => {
  try {
    await notificationService.markAllRead(req.userId);
    return res.json({ success: true, unreadCount: 0 });
  } catch (error) {
    return next(error);
  }
};
