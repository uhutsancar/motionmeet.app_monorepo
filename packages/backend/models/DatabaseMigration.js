import mongoose from "mongoose";

const databaseMigrationSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    appliedAt: { type: Date, required: true, default: Date.now },
    checksum: { type: String, required: true },
  },
  {
    collection: "database_migrations",
    versionKey: false,
  }
);

const DatabaseMigration = mongoose.model(
  "DatabaseMigration",
  databaseMigrationSchema
);

export default DatabaseMigration;
