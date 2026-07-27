const MIN_PRODUCTION_SECRET_LENGTH = 32;

const requireValues = (names, context) => {
  const missing = names.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(
      `Missing ${context} environment variables: ${missing.join(", ")}`
    );
  }
};

const requireUrl = (name, protocols) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required in production`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (!protocols.includes(parsed.protocol)) {
    throw new Error(`${name} must use ${protocols.join(" or ")}`);
  }
  return parsed;
};

export const validateEnvironment = () => {
  const required = ["MONGODB_URL", "MONGODB_DB_NAME", "JWT_SECRET"];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const databaseName = process.env.MONGODB_DB_NAME.trim();
  if (
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/.test(databaseName) ||
    ["admin", "config", "local", "test"].includes(databaseName.toLowerCase())
  ) {
    throw new Error(
      "MONGODB_DB_NAME must be an explicit application database name and cannot be admin, config, local, or test"
    );
  }

  const secretLength = Buffer.byteLength(process.env.JWT_SECRET.trim(), "utf8");
  if (
    process.env.NODE_ENV === "production" &&
    secretLength < MIN_PRODUCTION_SECRET_LENGTH
  ) {
    throw new Error(`JWT_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} bytes in production`);
  }

  if (process.env.NODE_ENV === "production") {
    requireUrl("MONGODB_URL", ["mongodb:", "mongodb+srv:"]);
    requireUrl("REDIS_URL", ["redis:", "rediss:"]);
    const frontend = requireUrl("FRONTEND_URL", ["https:"]);
    if (frontend.origin !== process.env.FRONTEND_URL.trim().replace(/\/$/, "")) {
      throw new Error("FRONTEND_URL must contain only an HTTPS origin");
    }
    const origins = (process.env.CORS_ORIGINS || frontend.origin)
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    for (const origin of origins) {
      const parsed = requireUrlValue("CORS_ORIGINS", origin, ["https:", "http:"]);
      
      const isLocal = ["localhost", "127.0.0.1"].includes(parsed.hostname) || parsed.hostname.startsWith("192.168.") || parsed.hostname.startsWith("172.");
      if (parsed.protocol === "http:" && !isLocal) {
        throw new Error("CORS_ORIGINS entries must use https (except for local testing IPs)");
      }

      if (parsed.origin !== origin.replace(/\/$/, "")) {
        throw new Error("CORS_ORIGINS entries must contain only an origin");
      }
    }

    const mediaUploadsEnabled =
      process.env.MEDIA_UPLOADS_ENABLED?.trim().toLowerCase() !== "false";
    if (mediaUploadsEnabled) {
      requireValues(
        [
          "AWS_ACCESS_KEY_ID",
          "AWS_SECRET_ACCESS_KEY",
          "AWS_BUCKET_NAME",
          "IMAGEKIT_PUBLIC_KEY",
          "IMAGEKIT_PRIVATE_KEY",
        ],
        "media"
      );
      requireUrl("IMAGEKIT_URL_ENDPOINT", ["https:"]);
    }

    const emailEnabled =
      process.env.EMAIL_ENABLED?.trim().toLowerCase() !== "false";
    if (emailEnabled) {
      requireValues(
        ["SMTP_USER", "SMTP_PASS", "SENDER_EMAIL"],
        "email"
      );
    }
  }
};

const requireUrlValue = (name, value, protocols) => {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must contain valid URLs`);
  }
  if (!protocols.includes(parsed.protocol)) {
    throw new Error(`${name} must use ${protocols.join(" or ")}`);
  }
  return parsed;
};
