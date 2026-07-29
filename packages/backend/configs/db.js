import mongoose from "mongoose";

const integerSetting = (name, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
};

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
  mongoose.set(
    "maxTimeMS",
    integerSetting("MONGODB_MAX_TIME_MS", 15_000, 1_000, 600_000)
  );

  mongoose.connection.on("error", (error) => {
    console.error("Database connection error:", error.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("Database disconnected");
  });

  await mongoose.connect(databaseUrl, {
    dbName: databaseName,
    appName: process.env.MONGODB_APP_NAME || "motionmeet-api",
    autoIndex: process.env.NODE_ENV !== "production",
    serverSelectionTimeoutMS: integerSetting(
      "MONGODB_SERVER_SELECTION_TIMEOUT_MS",
      10_000,
      1_000,
      60_000
    ),
    waitQueueTimeoutMS: integerSetting(
      "MONGODB_WAIT_QUEUE_TIMEOUT_MS",
      3_000,
      250,
      60_000
    ),
    maxPoolSize: integerSetting(
      "MONGODB_MAX_POOL_SIZE",
      process.env.NODE_ENV === "production" ? 50 : 10,
      5,
      500
    ),
    minPoolSize: integerSetting(
      "MONGODB_MIN_POOL_SIZE",
      process.env.NODE_ENV === "production" ? 0 : 1,
      0,
      100
    ),
    maxIdleTimeMS: integerSetting(
      "MONGODB_MAX_IDLE_TIME_MS",
      30_000,
      1_000,
      300_000
    ),
    retryWrites: true,
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
