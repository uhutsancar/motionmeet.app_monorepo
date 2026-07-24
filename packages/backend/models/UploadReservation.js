import mongoose from "mongoose";

const uploadReservationSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    userId: { type: String, ref: "User", required: true },
    purpose: {
      type: String,
      enum: ["profiles", "covers", "posts", "stories", "messages"],
      required: true,
    },
    contentType: { type: String, required: true },
    maxBytes: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

uploadReservationSchema.index({ expiresAt: 1 });
uploadReservationSchema.index({ userId: 1, purpose: 1, createdAt: -1 });

const UploadReservation = mongoose.model(
  "UploadReservation",
  uploadReservationSchema
);

export default UploadReservation;
