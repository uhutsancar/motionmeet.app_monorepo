import Plan from "../models/Plan.js";

// ────────────────────────────────────────────────────────────────
// Ücretsiz plan
// ────────────────────────────────────────────────────────────────
const FREE_PLAN_DEFAULTS = {
  name: "Free",
  slug: "free",
  description: "Start your fitness journey with the essentials.",
  displayOrder: 0,
  price: 0,
  currency: "TRY",
  trialDays: 0,
  billingCycles: [],
  features: {
    max_workouts_per_month: 5,
    max_routines: 2,
    max_posts_per_day: -1,
    max_stories_per_day: -1,
    max_media_upload_mb: 20,
    can_message_anyone: false,
    premium_content_access: false,
    ad_free: false,
    priority_support: false,
    can_access_analytics: false,
    can_create_custom_exercises: true,
  },
  isActive: true,
};

// ────────────────────────────────────────────────────────────────
// Pro plan (Ücretli)
// ────────────────────────────────────────────────────────────────
const PRO_PLAN_DEFAULTS = {
  name: "Pro",
  slug: "pro",
  description: "Unlock unlimited workouts, analytics and more.",
  displayOrder: 1,
  price: 149,
  currency: "TRY",
  trialDays: 7,
  billingCycles: [
    { interval: "monthly", price: 149, currency: "TRY", stripePriceId: "" },
    { interval: "yearly",  price: 999, currency: "TRY", stripePriceId: "" },
  ],
  features: {
    max_workouts_per_month: -1,   // sınırsız
    max_routines: -1,             // sınırsız
    max_posts_per_day: -1,
    max_stories_per_day: -1,
    max_media_upload_mb: 50,
    can_message_anyone: true,
    premium_content_access: true,
    ad_free: true,
    priority_support: false,
    can_access_analytics: true,
    can_create_custom_exercises: true,
  },
  isActive: true,
};

// ────────────────────────────────────────────────────────────────
// Premium plan (İleride kullanım için)
// ────────────────────────────────────────────────────────────────
const PREMIUM_PLAN_DEFAULTS = {
  name: "Premium",
  slug: "premium",
  description: "The ultimate fitness experience with priority support.",
  displayOrder: 2,
  price: 299,
  currency: "TRY",
  trialDays: 14,
  billingCycles: [
    { interval: "monthly", price: 299, currency: "TRY", stripePriceId: "" },
    { interval: "yearly",  price: 1999, currency: "TRY", stripePriceId: "" },
  ],
  features: {
    max_workouts_per_month: -1,
    max_routines: -1,
    max_posts_per_day: -1,
    max_stories_per_day: -1,
    max_media_upload_mb: 100,
    can_message_anyone: true,
    premium_content_access: true,
    ad_free: true,
    priority_support: true,
    can_access_analytics: true,
    can_create_custom_exercises: true,
  },
  isActive: false, // Henüz aktif değil — admin panelinden açılacak
};

// ────────────────────────────────────────────────────────────────
// Yardımcı: Plan bulamazsa oluştur (idempotent)
// ────────────────────────────────────────────────────────────────
const getOrCreatePlan = (defaults) =>
  Plan.findOneAndUpdate(
    { slug: defaults.slug },
    { $setOnInsert: defaults },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

export const getOrCreateFreePlan    = () => getOrCreatePlan(FREE_PLAN_DEFAULTS);
export const getOrCreateProPlan     = () => getOrCreatePlan(PRO_PLAN_DEFAULTS);
export const getOrCreatePremiumPlan = () => getOrCreatePlan(PREMIUM_PLAN_DEFAULTS);
