import mongoose from "mongoose";

// Süresi dolan hikayeler worker tarafından atomik medya kuyruğuna alınıp silinir.

const storySchema = new mongoose.Schema(
  {
    user: { type: String, ref: "User", required: true },
    operationId: { type: String, maxlength: 128, default: null },
    content: { type: String, maxlength: 2000, default: "" },
    media_url: { type: String, maxlength: 2048 },
    media_key: { type: String, maxlength: 1024, default: "", select: false },
    media_type: {
      type: String,
      enum: ["text", "image", "video"],
    },
    background_color: { type: String, maxlength: 32, default: "" },

    // Worker bu alanı tarar; sorgular da süresi dolmuş kayıtları göstermemek için filtreler.
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 saat sonra
    },
  },
  { timestamps: true, minimize: false }
);

// Kullanıcı hikayeleri sıralı getirme
storySchema.index({ user: 1, expiresAt: 1, createdAt: -1, _id: -1 });

// Cron job için tüm eski hikayeleri bulma
storySchema.index({ expiresAt: 1, _id: 1 });
storySchema.index(
  { user: 1, operationId: 1 },
  {
    unique: true,
    partialFilterExpression: { operationId: { $type: "string" } },
  }
);
storySchema.set("toJSON", {
  transform(_document, value) {
    delete value.media_key;
    return value;
  },
});

const Story = mongoose.model("Story", storySchema);

export default Story;
