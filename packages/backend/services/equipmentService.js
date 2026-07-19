import Equipment from "../models/Equipment.js";

export const getEquipmentList = async (filter = {}) => {
  return await Equipment.find(filter).sort({ order: 1 });
};
