import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    full_name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9._-]+$/,
    },
    password: { type: String, required: true, select: false },
    bio: { type: String, default: "Athlete on MotionMeet", maxlength: 500 },
    profile_picture: { type: String, default: "" },
    profile_picture_key: { type: String, default: "", select: false },
    cover_photo: { type: String, default: "" },
    cover_photo_key: { type: String, default: "", select: false },
    location: { type: String, default: "", maxlength: 100 },
    role: { type: String, enum: ["user", "admin", "superadmin"], default: "user" },

    // ── Plan & Subscription ─────────────────────────────────────
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
    // Abonelik durumu: free = ücretsiz plan, active = ücretli plan aktif,
    // trialing = deneme sürecinde, cancelled = iptal edildi (bitiş tarihine kadar aktif),
    // expired = süresi dolmuş
    planStatus: {
      type: String,
      enum: ["free", "active", "trialing", "cancelled", "expired"],
      default: "free",
    },
    planStartDate: { type: Date, default: null },
    planEndDate:   { type: Date, default: null },
    planCancelledAt: { type: Date, default: null },
    // Ödeme sağlayıcı referansları (Stripe vb. entegrasyonu için)
    stripeCustomerId:     { type: String, default: "", select: false },
    stripeSubscriptionId: { type: String, default: "", select: false },

    // ── Profil Ölçümleri ────────────────────────────────────────
    weight: { type: Number, default: 0, min: 0, max: 1000 },
    height: { type: Number, default: 0, min: 0, max: 300 },

    // ── Sosyal Sayaçlar ─────────────────────────────────────────
    followers_count:   { type: Number, default: 0, min: 0 },
    following_count:   { type: Number, default: 0, min: 0 },
    connections_count: { type: Number, default: 0, min: 0 },

    // ── Gizlilik Ayarları ───────────────────────────────────────
    privacy: {
      publicProfile:      { type: Boolean, default: true },
      showWorkoutsOnFeed: { type: Boolean, default: true },
      allowFollowers:     { type: Boolean, default: true },
      showInSearch:       { type: Boolean, default: true },
      allowMessages:      { type: Boolean, default: true },
    },

    // ── İstatistikler ───────────────────────────────────────────
    statistics: {
      totalWorkouts:       { type: Number, default: 0, min: 0 },
      totalDurationMinutes:{ type: Number, default: 0, min: 0 },
      totalVolumeKg:       { type: Number, default: 0, min: 0 },
    },
  },
  { timestamps: true, minimize: false }
);

userSchema.index(
  { username: "text", full_name: "text" },
  { weights: { username: 3, full_name: 1 }, name: "UserSearchTextIndex" }
);

// Plan durumu üzerinden sorgu yapılabilmesi için
userSchema.index({ planStatus: 1, planEndDate: 1 });
userSchema.index({ createdAt: -1, _id: -1 });

const User = mongoose.model("User", userSchema);

export default User;
