import * as equipmentService from "../services/equipmentService.js";

export const getEquipment = async (req, res, next) => {
  try {
    const { isActive } = req.query;
    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const equipmentList = await equipmentService.getEquipmentList(filter);
    res.json({ success: true, data: equipmentList });
  } catch (error) {
    next(error);
  }
};
