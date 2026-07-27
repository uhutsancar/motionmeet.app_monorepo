import mongoose from "mongoose";

// Hikayeler 24 saat sonra otomatik silinir.
// expiresAt üzerinde TTL index tanımlanmıştır — MongoDB bu field 0 olduğunda belgeyi siler.
// Cron job ile çakışma yaşanmaması için her ikisi de birlikte kullanılabilir;
// cron job ek bir güvence sağlar (medya S3'ten silinmesi için hâlâ gereklidir).

const storySchema = new mongoose.Schema(
  {
    user: { type: String, ref: "User", required: true },
    content: { type: String },
    media_url: { type: String },
    media_key: { type: String, default: "", select: false },
    media_type: {
      type: String,
      enum: ["text", "image", "video"],
    },
    background_color: { type: String },

    // Otomatik silme zamanı. Yeni story oluştururken createdAt + 24 saat olarak set edilir.
    // MongoDB TTL index bu alanı izler ve süre dolduğunda belgeyi siler (DB tarafında).
    // NOT: MongoDB TTL taraması 60 saniyede bir çalışır; bu yüzden tam 24 saatte silinmeyebilir,
    //      ancak en geç 60 saniyelik gecikmeyle silinir.
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 saat sonra
    },
  },
  { timestamps: true, minimize: false }
);

// Kullanıcı hikayeleri sıralı getirme
storySchema.index({ user: 1, createdAt: -1 });

// Cron job için tüm eski hikayeleri bulma
storySchema.index({ createdAt: 1 });

// TTL index: expiresAt değeri geçen belgeler MongoDB tarafından otomatik silinir.
// expireAfterSeconds: 0 → alan değeri doğrudan hedef silme zamanı olarak kullanılır.
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "StoryTTLIndex" });

const Story = mongoose.model("Story", storySchema);

export default Story;
