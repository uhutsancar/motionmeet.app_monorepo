import * as muscleGroupService from "../services/muscleGroupService.js";
import type { RequestHandler } from "express";

export const getMuscleGroups: RequestHandler = async (req, res, next) => {
  try {
    const { isActive } = req.query;
    const filter: { isActive?: boolean } = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const muscleGroups = await muscleGroupService.getMuscleGroupsList(filter);
    res.json({ success: true, data: muscleGroups });
  } catch (error) {
    next(error);
  }
};
