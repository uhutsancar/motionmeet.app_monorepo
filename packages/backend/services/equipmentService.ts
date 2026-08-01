import { database } from "../configs/database.js";

export interface LookupFilter { isActive?: boolean }

export const getEquipmentList = async (filter: LookupFilter = {}) => {
  let query = database.selectFrom("equipment").select(["id", "code", "name", "is_active", "display_order"]);
  if (filter.isActive !== undefined) query = query.where("is_active", "=", filter.isActive);
  return (await query.orderBy("display_order").execute()).map((row) => ({
    id: row.id, _id: row.id, code: row.code, name: row.name, isActive: row.is_active, order: row.display_order,
  }));
};
