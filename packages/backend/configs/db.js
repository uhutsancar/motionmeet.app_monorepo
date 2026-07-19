import mongoose from "mongoose";

const connectDB = async () => {
  const databaseUrl = process.env.MONGODB_URL?.trim();
  if (!databaseUrl) {
    throw new Error("MONGODB_URL is required");
  }

  mongoose.set("strictQuery", true);

  mongoose.connection.on("error", (error) => {
    console.error("Database connection error:", error.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("Database disconnected");
  });

  const databaseName = process.env.MONGODB_DB_NAME?.trim();
  await mongoose.connect(databaseUrl, {
    ...(databaseName ? { dbName: databaseName } : {}),
    serverSelectionTimeoutMS: 10000,
  });

  console.log("Database connected");
  return mongoose.connection;
};

export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};

export default connectDB;
