import type { EntityId } from "./common.js";

/** Metrics an athlete can log. Every one is optional on any given day. */
export interface BodyMeasurementValues {
  weightKg?: number | null;
  bodyFatPercentage?: number | null;
  waistCm?: number | null;
  chestCm?: number | null;
  hipsCm?: number | null;
  neckCm?: number | null;
  shouldersCm?: number | null;
  leftArmCm?: number | null;
  rightArmCm?: number | null;
  leftThighCm?: number | null;
  rightThighCm?: number | null;
}

export interface BodyMeasurement extends BodyMeasurementValues {
  id: EntityId;
  /** Calendar day the measurement belongs to, as YYYY-MM-DD. */
  measuredOn: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export type BodyMeasurementMetric = keyof BodyMeasurementValues;
