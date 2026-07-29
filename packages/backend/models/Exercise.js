import mongoose from "mongoose";

const exerciseSchema = new mongoose.Schema(
  {
    // Dataset'ten gelen orijinal kimlik (örn. "0001")
    externalId: { type: String, unique: true, sparse: true, index: true },

    name: { type: String, required: true, trim: true, maxlength: 200 },
    nameNormalized: {
      type: String,
      required: true,
      select: false,
      maxlength: 200,
    },

    // Dataset'teki "body_part" alanına map edilir (geniş kas grubu, örn. "waist", "chest")
    muscleGroup: { type: String, required: true, index: true },

    // Dataset'teki "target" alanı (birincil hedef kas, örn. "abs", "pectorals")
    target: { type: String, default: "" },

    // Dataset'teki "category" alanı (örn. "strength", "cardio", "stretching")
    category: { type: String, default: "" },

    // Dataset'teki "secondary_muscles" alanı (ikincil kaslar listesi)
    secondary_muscles: { type: [String], default: [] },

    equipment: { type: String, required: true },

    // Thumbnail görsel URL'si (S3/CloudFront)
    imageUrl: { type: String, default: "" },

    // Animasyon GIF URL'si (S3/CloudFront)
    gifUrl: { type: String, default: "" },

    // Çok dilli talimat metinleri: { en: "...", tr: "...", es: "...", it: "..." }
    instructions: { type: Map, of: String, default: {} },

    // Çok dilli adım adım talimatlar: { en: ["adım1", "adım2"], tr: [...] }
    instructionSteps: { type: Map, of: [String], default: {} },

    // true = kullanıcı tarafından oluşturulmuş özel egzersiz
    isCustom: { type: Boolean, default: false },

    // Özel egzersiz oluşturan kullanıcının ID'si
    createdBy: { type: String, ref: "User", default: null },
  },
  { timestamps: true }
);

// Tam metin arama (isim + kas grubu)
exerciseSchema.index({ name: "text", muscleGroup: "text" });

// Kullanıcının kendi özel egzersizlerini sıralı getirmek için
exerciseSchema.index({ createdBy: 1, name: 1 });

// Filtreleme sorguları: muscleGroup + equipment kombinasyonu çok yaygın
exerciseSchema.index({ muscleGroup: 1, equipment: 1 });

// category bazlı filtreleme
exerciseSchema.index({ category: 1 });
exerciseSchema.index({
  isCustom: 1,
  muscleGroup: 1,
  equipment: 1,
  nameNormalized: 1,
  _id: 1,
});
exerciseSchema.index({ createdBy: 1, nameNormalized: 1, _id: 1 });

exerciseSchema.pre("validate", function normalizeName() {
  this.nameNormalized = String(this.name || "").trim().toLocaleLowerCase("en-US");
});

const Exercise = mongoose.model("Exercise", exerciseSchema);

export default Exercise;
