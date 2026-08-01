import { withTransaction } from "../configs/database.js";
import { serializePlan, type InternalPlan } from "../repositories/entities.js";

interface PlanDefaults {
  name: string;
  slug: string;
  description: string;
  displayOrder: number;
  trialDays: number;
  price: number;
  currency: string;
  billingCycles: Array<{ interval: "monthly" | "yearly"; price: number; currency: string; stripePriceId: string }>;
  maxWorkoutsPerMonth: number;
  maxRoutines: number;
  maxPostsPerDay: number;
  maxStoriesPerDay: number;
  maxMediaUploadMb: number;
  canMessageAnyone: boolean;
  premiumContentAccess: boolean;
  adFree: boolean;
  prioritySupport: boolean;
  canAccessAnalytics: boolean;
  canCreateCustomExercises: boolean;
  isActive: boolean;
}

const FREE_PLAN: PlanDefaults = {
  name: "Free", slug: "free", description: "Start your fitness journey with the essentials.",
  displayOrder: 0, trialDays: 0, price: 0, currency: "TRY", billingCycles: [],
  maxWorkoutsPerMonth: 5, maxRoutines: 2, maxPostsPerDay: -1, maxStoriesPerDay: -1,
  maxMediaUploadMb: 20, canMessageAnyone: false, premiumContentAccess: false,
  adFree: false, prioritySupport: false, canAccessAnalytics: false,
  canCreateCustomExercises: true, isActive: true,
};

const PRO_PLAN: PlanDefaults = {
  name: "Pro", slug: "pro", description: "Unlock unlimited workouts, analytics and more.",
  displayOrder: 1, trialDays: 7, price: 149, currency: "TRY",
  billingCycles: [
    { interval: "monthly", price: 149, currency: "TRY", stripePriceId: "" },
    { interval: "yearly", price: 999, currency: "TRY", stripePriceId: "" },
  ],
  maxWorkoutsPerMonth: -1, maxRoutines: -1, maxPostsPerDay: -1, maxStoriesPerDay: -1,
  maxMediaUploadMb: 50, canMessageAnyone: true, premiumContentAccess: true,
  adFree: true, prioritySupport: false, canAccessAnalytics: true,
  canCreateCustomExercises: true, isActive: true,
};

const PREMIUM_PLAN: PlanDefaults = {
  name: "Premium", slug: "premium", description: "The ultimate fitness experience with priority support.",
  displayOrder: 2, trialDays: 14, price: 299, currency: "TRY",
  billingCycles: [
    { interval: "monthly", price: 299, currency: "TRY", stripePriceId: "" },
    { interval: "yearly", price: 1999, currency: "TRY", stripePriceId: "" },
  ],
  maxWorkoutsPerMonth: -1, maxRoutines: -1, maxPostsPerDay: -1, maxStoriesPerDay: -1,
  maxMediaUploadMb: 100, canMessageAnyone: true, premiumContentAccess: true,
  adFree: true, prioritySupport: true, canAccessAnalytics: true,
  canCreateCustomExercises: true, isActive: false,
};

const getOrCreatePlan = async (defaults: PlanDefaults): Promise<InternalPlan> => withTransaction(async (transaction) => {
  const plan = await transaction.insertInto("plans").values({
    legacy_mongo_id: null,
    name: defaults.name,
    slug: defaults.slug,
    description: defaults.description,
    display_order: defaults.displayOrder,
    trial_days: defaults.trialDays,
    price: defaults.price,
    currency: defaults.currency,
    max_workouts_per_month: defaults.maxWorkoutsPerMonth,
    max_routines: defaults.maxRoutines,
    max_posts_per_day: defaults.maxPostsPerDay,
    max_stories_per_day: defaults.maxStoriesPerDay,
    max_media_upload_mb: defaults.maxMediaUploadMb,
    can_message_anyone: defaults.canMessageAnyone,
    premium_content_access: defaults.premiumContentAccess,
    ad_free: defaults.adFree,
    priority_support: defaults.prioritySupport,
    can_access_analytics: defaults.canAccessAnalytics,
    can_create_custom_exercises: defaults.canCreateCustomExercises,
    is_active: defaults.isActive,
  }).onConflict((conflict) => conflict.column("slug").doUpdateSet({ name: defaults.name }))
    .returningAll().executeTakeFirstOrThrow();

  for (const cycle of defaults.billingCycles) {
    await transaction.insertInto("plan_billing_cycles").values({
      plan_id: plan.id, interval: cycle.interval, price: cycle.price,
      currency: cycle.currency, stripe_price_id: cycle.stripePriceId,
    }).onConflict((conflict) => conflict.columns(["plan_id", "interval"]).doNothing()).execute();
  }
  const cycles = await transaction.selectFrom("plan_billing_cycles").selectAll().where("plan_id", "=", plan.id).execute();
  return serializePlan(plan, cycles);
});

export const getOrCreateFreePlan = (): Promise<InternalPlan> => getOrCreatePlan(FREE_PLAN);
export const getOrCreateProPlan = (): Promise<InternalPlan> => getOrCreatePlan(PRO_PLAN);
export const getOrCreatePremiumPlan = (): Promise<InternalPlan> => getOrCreatePlan(PREMIUM_PLAN);

export const ensureDefaultPlans = async (): Promise<void> => {
  await Promise.all([getOrCreateFreePlan(), getOrCreateProPlan(), getOrCreatePremiumPlan()]);
};
