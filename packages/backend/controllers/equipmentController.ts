import * as equipmentService from "../services/equipmentService.js";
import type { RequestHandler } from "express";

export const getEquipment: RequestHandler = async (req, res, next) => {
  try {
    const { isActive } = req.query;
    const filter: { isActive?: boolean } = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const equipmentList = await equipmentService.getEquipmentList(filter);
    res.json({ success: true, data: equipmentList });
  } catch (error) {
    next(error);
  }
};
