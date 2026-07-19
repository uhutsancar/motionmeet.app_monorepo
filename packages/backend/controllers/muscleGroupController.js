import * as muscleGroupService from "../services/muscleGroupService.js";

export const getMuscleGroups = async (req, res, next) => {
  try {
    const { isActive } = req.query;
    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const muscleGroups = await muscleGroupService.getMuscleGroupsList(filter);
    res.json({ success: true, data: muscleGroups });
  } catch (error) {
    next(error);
  }
};
