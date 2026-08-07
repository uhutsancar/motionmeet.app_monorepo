import type { Plan, PlanFeatures, PrivacySettings, ProfileLocation, ProfileLocationSource, User, UserStatistics } from "@motionmeet/shared";
import type { Row } from "../db/types.js";

export interface InternalPlan extends Plan {
  stripePriceIds: Partial<Record<"monthly" | "yearly", string>>;
}

export interface InternalUser extends User {
  password?: string;
  profile_picture_key?: string;
  cover_photo_key?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export const numberValue = (value: number | string | null | undefined): number => {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
};

const iso = (value: Date | string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const planFeatures = (row: Row<"plans">): PlanFeatures => ({
  max_workouts_per_month: row.max_workouts_per_month,
  max_routines: row.max_routines,
  max_posts_per_day: row.max_posts_per_day,
  max_stories_per_day: row.max_stories_per_day,
  max_media_upload_mb: row.max_media_upload_mb,
  can_message_anyone: row.can_message_anyone,
  premium_content_access: row.premium_content_access,
  ad_free: row.ad_free,
  priority_support: row.priority_support,
  can_access_analytics: row.can_access_analytics,
  can_create_custom_exercises: row.can_create_custom_exercises,
});

export const serializePlan = (
  row: Row<"plans">,
  cycles: Array<Row<"plan_billing_cycles">> = [],
): InternalPlan => ({
  id: row.id,
  _id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description,
  displayOrder: row.display_order,
  trialDays: row.trial_days,
  billingCycles: cycles.map((cycle) => ({
    interval: cycle.interval,
    price: numberValue(cycle.price),
    currency: cycle.currency,
    stripePriceId: cycle.stripe_price_id,
  })),
  price: numberValue(row.price),
  currency: row.currency,
  features: planFeatures(row),
  isActive: row.is_active,
  createdAt: iso(row.created_at) ?? new Date(0).toISOString(),
  updatedAt: iso(row.updated_at) ?? new Date(0).toISOString(),
  stripePriceIds: Object.fromEntries(cycles.map((cycle) => [cycle.interval, cycle.stripe_price_id])),
});

export const privacySettings = (row: Row<"users">): PrivacySettings => ({
  publicProfile: row.privacy_public_profile,
  showWorkoutsOnFeed: row.privacy_show_workouts_on_feed,
  allowFollowers: row.privacy_allow_followers,
  showInSearch: row.privacy_show_in_search,
  allowMessages: row.privacy_allow_messages,
});

/**
 * The dataset record behind `users.location`. Attached to the owner's own
 * payload so the picker can pre-select what is already saved; other people only
 * ever receive the rendered label.
 *
 * `countryCode` stays empty here: this serialiser only sees the `users` row and
 * resolving the code would cost a join on every profile read. Callers that need
 * it use GET /api/user/location, which joins and fills it in.
 */
export const profileLocation = (row: Row<"users">): ProfileLocation => ({
  countryId: row.location_country_id,
  stateId: row.location_state_id,
  cityId: row.location_city_id,
  displayName: row.location,
  countryCode: "",
  source: (row.location_source || null) as ProfileLocationSource | null,
  visibility: row.location_visibility,
  selectedAt: iso(row.location_selected_at),
});

export const userStatistics = (row: Row<"users">): UserStatistics => ({
  totalWorkouts: row.total_workouts,
  totalDurationMinutes: row.total_duration_minutes,
  totalVolumeKg: numberValue(row.total_volume_kg),
});

export const serializeUser = (row: Row<"users">, plan: InternalPlan | null = null, includeSensitive = false): InternalUser => {
  const createdAt = iso(row.created_at) ?? new Date(0).toISOString();
  const updatedAt = iso(row.updated_at) ?? createdAt;
  return {
    id: row.id,
    _id: row.id,
    email: row.email,
    full_name: row.full_name,
    username: row.username,
    bio: row.bio,
    profile_picture: row.profile_picture_url,
    cover_photo: row.cover_photo_url,
    location: row.location,
    profileLocation: profileLocation(row),
    role: row.role,
    plan: plan ?? row.plan_id,
    planStatus: row.plan_status,
    planStartDate: iso(row.plan_start_date),
    planEndDate: iso(row.plan_end_date),
    planCancelledAt: iso(row.plan_cancelled_at),
    weight: numberValue(row.weight),
    height: numberValue(row.height),
    followers_count: row.followers_count,
    following_count: row.following_count,
    connections_count: row.connections_count,
    privacy: privacySettings(row),
    statistics: userStatistics(row),
    createdAt,
    updatedAt,
    ...(includeSensitive
      ? {
          password: row.password_hash,
          profile_picture_key: row.profile_picture_key,
          cover_photo_key: row.cover_photo_key,
          stripeCustomerId: row.stripe_customer_id,
          stripeSubscriptionId: row.stripe_subscription_id,
        }
      : {}),
  };
};

export interface InternalExercise {
  id: string;
  _id: string;
  externalId: string | null;
  name: string;
  muscleGroup: string;
  target: string;
  category: string;
  secondary_muscles: string[];
  equipment: string;
  imageUrl: string;
  gifUrl: string;
  instructions: Record<string, string>;
  instructionSteps: Record<string, string[]>;
  isCustom: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export const serializeExercise = (
  row: Row<"exercises">,
  secondaryMuscles: string[] = [],
  instructions: Array<Row<"exercise_instructions">> = [],
): InternalExercise => ({
  id: row.id,
  _id: row.id,
  externalId: row.external_id,
  name: row.name,
  muscleGroup: row.muscle_group,
  target: row.target,
  category: row.category,
  secondary_muscles: secondaryMuscles,
  equipment: row.equipment,
  imageUrl: row.image_url,
  gifUrl: row.gif_url,
  instructions: Object.fromEntries(instructions.map((entry) => [entry.language, entry.summary])),
  instructionSteps: Object.fromEntries(instructions.map((entry) => [entry.language, entry.steps])),
  isCustom: row.is_custom,
  createdBy: row.created_by,
  createdAt: iso(row.created_at) ?? new Date(0).toISOString(),
  updatedAt: iso(row.updated_at) ?? new Date(0).toISOString(),
});

export const toIsoString = (value: Date | string | null | undefined): string | null => iso(value);
