const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

/**
 * @param {{email?: unknown, password?: unknown, full_name?: unknown, username?: unknown}} [payload]
 */
export const validateRegistration = (payload = {}) => {
  const { email, password, full_name, username } = payload;
  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";
  const normalizedUsername =
    typeof username === "string" ? username.trim().toLowerCase() : "";
  const normalizedName = typeof full_name === "string" ? full_name.trim() : "";
  const normalizedPassword = typeof password === "string" ? password : "";
  const passwordBytes = Buffer.byteLength(normalizedPassword, "utf8");

  const fieldErrors = {};
  if (normalizedEmail.length > 254 || !EMAIL_PATTERN.test(normalizedEmail)) {
    fieldErrors.email = "Enter a valid email address";
  }
  if (!USERNAME_PATTERN.test(normalizedUsername)) {
    fieldErrors.username =
      "Use 3-30 lowercase letters, numbers, dots, underscores, or hyphens";
  }
  if (normalizedName.length < 2 || normalizedName.length > 100) {
    fieldErrors.full_name =
      "Full name must be between 2 and 100 characters";
  }
  if (passwordBytes < 10 || passwordBytes > 72) {
    fieldErrors.password = "Password must be between 10 and 72 UTF-8 bytes";
  }

  return {
    fieldErrors,
    normalized: {
      email: normalizedEmail,
      full_name: normalizedName,
      password: normalizedPassword,
      username: normalizedUsername,
    },
  };
};

export const validateLogin = (payload = {}) => {
  const email =
    typeof payload.email === "string"
      ? payload.email.trim().toLowerCase()
      : "";
  const password =
    typeof payload.password === "string" ? payload.password : "";
  const passwordBytes = Buffer.byteLength(password, "utf8");
  return {
    email,
    password,
    valid:
      EMAIL_PATTERN.test(email) &&
      email.length <= 254 &&
      passwordBytes >= 1 &&
      passwordBytes <= 72,
  };
};
