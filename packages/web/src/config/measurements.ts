import type { BodyMeasurementMetric } from "@motionmeet/shared";

export interface MeasurementMetricConfig {
  key: BodyMeasurementMetric;
  labelKey: string;
  fallback: string;
  unit: "kg" | "cm" | "%";
  /** Accepted range, mirrored from the backend validator. */
  min: number;
  max: number;
  color: string;
}

/**
 * Display order and units for the measurement pages. Weight and body fat lead
 * because they are the two an athlete logs most often; the circumferences that
 * come in pairs stay next to each other so they read as one group.
 */
export const MEASUREMENT_METRICS: readonly MeasurementMetricConfig[] = Object.freeze([
  { key: "weightKg", labelKey: "measurements.weight", fallback: "Weight", unit: "kg", min: 20, max: 500, color: "#5D50E6" },
  { key: "bodyFatPercentage", labelKey: "measurements.body_fat", fallback: "Body fat", unit: "%", min: 1, max: 75, color: "#F2665C" },
  { key: "chestCm", labelKey: "measurements.chest", fallback: "Chest", unit: "cm", min: 20, max: 300, color: "#3B82F6" },
  { key: "shouldersCm", labelKey: "measurements.shoulders", fallback: "Shoulders", unit: "cm", min: 20, max: 300, color: "#0EA5A5" },
  { key: "waistCm", labelKey: "measurements.waist", fallback: "Waist", unit: "cm", min: 20, max: 300, color: "#D98A12" },
  { key: "hipsCm", labelKey: "measurements.hips", fallback: "Hips", unit: "cm", min: 20, max: 300, color: "#8B5CF6" },
  { key: "neckCm", labelKey: "measurements.neck", fallback: "Neck", unit: "cm", min: 10, max: 120, color: "#64748B" },
  { key: "leftArmCm", labelKey: "measurements.left_arm", fallback: "Left arm", unit: "cm", min: 10, max: 150, color: "#22A06B" },
  { key: "rightArmCm", labelKey: "measurements.right_arm", fallback: "Right arm", unit: "cm", min: 10, max: 150, color: "#22A06B" },
  { key: "leftThighCm", labelKey: "measurements.left_thigh", fallback: "Left thigh", unit: "cm", min: 10, max: 200, color: "#B45309" },
  { key: "rightThighCm", labelKey: "measurements.right_thigh", fallback: "Right thigh", unit: "cm", min: 10, max: 200, color: "#B45309" },
]);

/** Local calendar day as YYYY-MM-DD - never the UTC one, which can be off by a day. */
export const toDayKey = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

export const dayKeyToDate = (dayKey: string): Date => {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

/** Trailing zeros only get in the way when the value is a whole number. */
export const formatMetricValue = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
};
