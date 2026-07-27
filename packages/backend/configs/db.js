import mongoose from "mongoose";

const connectDB = async () => {
  const databaseUrl = process.env.MONGODB_URL?.trim();
  if (!databaseUrl) {
    throw new Error("MONGODB_URL is required");
  }
  const databaseName = process.env.MONGODB_DB_NAME?.trim();
  if (!databaseName) {
    throw new Error(
      "MONGODB_DB_NAME is required; refusing to use MongoDB's implicit test database"
    );
  }

  mongoose.set("strictQuery", true);

  mongoose.connection.on("error", (error) => {
    console.error("Database connection error:", error.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("Database disconnected");
  });

  await mongoose.connect(databaseUrl, {
    dbName: databaseName,
    autoIndex: process.env.NODE_ENV !== "production",
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: process.env.NODE_ENV === "production" ? 200 : 10,
    minPoolSize: process.env.NODE_ENV === "production" ? 20 : 2,
    maxIdleTimeMS: 30000,
  });

  if (mongoose.connection.name !== databaseName) {
    throw new Error(
      `Connected to unexpected MongoDB database: ${mongoose.connection.name}`
    );
  }
  console.log(`Database connected: ${databaseName}`);
  return mongoose.connection;
};

export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};

export default connectDB;
