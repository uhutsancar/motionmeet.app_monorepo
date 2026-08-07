import type { RequestHandler } from "express";
import * as nearbyService from "../services/nearbyService.js";

/**
 * Nearby endpoints.
 *
 * The identity always comes from the verified token, never from the body, so a
 * caller cannot post a fix on someone else's behalf. Coordinates are read off
 * the request, validated, handed to the service and dropped - they are not
 * echoed back, not attached to the error path and not logged.
 */

export const getSettings: RequestHandler = async (req, res, next) => {
  try {
    return res.json({ success: true, settings: await nearbyService.getNearbySettings(req.userId) });
  } catch (error) {
    return next(error);
  }
};

export const updateSettings: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const patch: Parameters<typeof nearbyService.updateNearbySettings>[1] = {};

    if (body.enabled !== undefined) {
      if (typeof body.enabled !== "boolean") return res.status(400).json({ success: false, message: "enabled must be a boolean" });
      patch.enabled = body.enabled;
    }
    if (body.visible !== undefined) {
      if (typeof body.visible !== "boolean") return res.status(400).json({ success: false, message: "visible must be a boolean" });
      patch.visible = body.visible;
    }
    if (body.distanceVisibility !== undefined) {
      const parsed = nearbyService.parseDistanceVisibility(body.distanceVisibility);
      if (!parsed) return res.status(400).json({ success: false, message: "Unsupported distance visibility" });
      patch.distanceVisibility = parsed;
    }
    if (body.scope !== undefined) {
      const parsed = nearbyService.parseScope(body.scope);
      if (!parsed) return res.status(400).json({ success: false, message: "Unsupported search radius" });
      patch.scope = parsed;
    }
    if (!Object.keys(patch).length) return res.status(400).json({ success: false, message: "No supported settings were supplied" });

    return res.json({ success: true, settings: await nearbyService.updateNearbySettings(req.userId, patch) });
  } catch (error) {
    return next(error);
  }
};

export const updatePosition: RequestHandler = async (req, res, next) => {
  try {
    const latitude = nearbyService.parseCoordinate(req.body?.latitude, 90);
    const longitude = nearbyService.parseCoordinate(req.body?.longitude, 180);
    if (latitude === null || longitude === null) {
      return res.status(400).json({ success: false, message: "Invalid coordinates" });
    }
    const source = ["gps", "network", "coarse"].includes(req.body?.source) ? req.body.source as "gps" | "network" | "coarse" : "gps";

    const settings = await nearbyService.savePosition(req.userId, {
      latitude,
      longitude,
      accuracy: req.body?.accuracy,
      source,
      permissionStatus: typeof req.body?.permissionStatus === "string" ? req.body.permissionStatus : undefined,
    });
    return res.json({ success: true, settings });
  } catch (error) {
    return next(error);
  }
};

export const deletePosition: RequestHandler = async (req, res, next) => {
  try {
    await nearbyService.deletePosition(req.userId);
    return res.json({ success: true, settings: await nearbyService.getNearbySettings(req.userId) });
  } catch (error) {
    return next(error);
  }
};

export const listNearbyUsers: RequestHandler = async (req, res, next) => {
  try {
    const limit = Number.parseInt(String(req.query?.limit ?? ""), 10);
    const result = await nearbyService.listNearbyUsers(req.userId, Number.isFinite(limit) ? limit : undefined);
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};
