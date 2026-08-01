import { database } from "../configs/database.js";
import type { LookupFilter } from "./equipmentService.js";

export const getMuscleGroupsList = async (filter: LookupFilter = {}) => {
  let query = database.selectFrom("muscle_groups").select(["id", "code", "name", "is_active", "display_order"]);
  if (filter.isActive !== undefined) query = query.where("is_active", "=", filter.isActive);
  return (await query.orderBy("display_order").execute()).map((row) => ({
    id: row.id, _id: row.id, code: row.code, name: row.name, isActive: row.is_active, order: row.display_order,
  }));
};
