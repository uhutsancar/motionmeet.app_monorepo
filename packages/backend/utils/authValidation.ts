const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;
export const validatePassword = (value: unknown): { password: string; valid: boolean } => {
  const password = typeof value === "string" ? value : ""; const bytes = Buffer.byteLength(password, "utf8"); return { password, valid: bytes >= 10 && bytes <= 72 };
};
interface RegistrationPayload { email?: unknown; password?: unknown; full_name?: unknown; username?: unknown }
export const validateRegistration = (payload: RegistrationPayload = {}) => {
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const username = typeof payload.username === "string" ? payload.username.trim().toLowerCase() : "";
  const fullName = typeof payload.full_name === "string" ? payload.full_name.trim() : ""; const password = validatePassword(payload.password);
  const fieldErrors: Partial<Record<"email" | "username" | "full_name" | "password", string>> = {};
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) fieldErrors.email = "Enter a valid email address";
  if (!USERNAME_PATTERN.test(username)) fieldErrors.username = "Use 3-30 lowercase letters, numbers, dots, underscores, or hyphens";
  if (fullName.length < 2 || fullName.length > 100) fieldErrors.full_name = "Full name must be between 2 and 100 characters";
  if (!password.valid) fieldErrors.password = "Password must be between 10 and 72 UTF-8 bytes";
  return { fieldErrors, normalized: { email, full_name: fullName, password: password.password, username } };
};
export const validateLogin = (payload: Pick<RegistrationPayload, "email" | "password"> = {}) => {
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : ""; const password = typeof payload.password === "string" ? payload.password : ""; const bytes = Buffer.byteLength(password, "utf8");
  return { email, password, valid: EMAIL_PATTERN.test(email) && email.length <= 254 && bytes >= 1 && bytes <= 72 };
};
