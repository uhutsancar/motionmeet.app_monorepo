import mongoose from "mongoose";

const billingCycleSchema = new mongoose.Schema(
  {
    interval: {
      type: String,
      enum: ["monthly", "yearly"],
      required: true,
    },
    price: { type: Number, required: true, default: 0 },
    currency: { type: String, default: "TRY" },
    // Stripe fiyat ID'si — ödeme entegrasyonu için
    stripePriceId: { type: String, default: "" },
  },
  { _id: false }
);

const planSchema = new mongoose.Schema(
  {
    // Kullanıcı dost isim (örn. "Free", "Pro", "Premium")
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    // URL/kod amaçlı benzersiz tanımlayıcı (örn. "free", "pro", "premium")
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    // Kısa açıklama (frontend'de plan kartında gösterilir)
    description: {
      type: String,
      default: "",
      trim: true,
    },
    // Sıralama (küçük sayı önce gelir)
    displayOrder: {
      type: Number,
      default: 0,
    },
    // Deneme süresi (gün cinsinden, 0 = yok)
    trialDays: {
      type: Number,
      default: 0,
    },
    // Ödeme döngüleri (aylık / yıllık seçenekler)
    billingCycles: {
      type: [billingCycleSchema],
      default: [],
    },
    // Geriye dönük uyumluluk için eski fiyat alanı
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      default: "TRY",
    },
    features: {
      // -1 = sınırsız
      max_workouts_per_month: { type: Number, default: 5 },
      max_routines: { type: Number, default: 2 },
      // Günlük post ve story limiti (-1 = sınırsız)
      max_posts_per_day: { type: Number, default: -1 },
      max_stories_per_day: { type: Number, default: -1 },
      // Maksimum medya yükleme boyutu (MB cinsinden)
      max_media_upload_mb: { type: Number, default: 20 },
      // Mesajlaşma: sadece bağlantılara mı yoksa herkese mi?
      can_message_anyone: { type: Boolean, default: false },
      // Premium içerik erişimi
      premium_content_access: { type: Boolean, default: false },
      // Reklamsız deneyim
      ad_free: { type: Boolean, default: false },
      // Öncelikli destek
      priority_support: { type: Boolean, default: false },
      // İstatistik / analiz paneli erişimi
      can_access_analytics: { type: Boolean, default: false },
      // Özel egzersiz oluşturma
      can_create_custom_exercises: { type: Boolean, default: true },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Aktif planları sıralı getirmek için
planSchema.index({ isActive: 1, displayOrder: 1 });


const Plan = mongoose.model("Plan", planSchema);

export default Plan;
