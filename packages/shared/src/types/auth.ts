import type { AuthUser } from "./user.js";

export interface AuthenticationResponse {
  success: true;
  user: AuthUser;
  token: string;
  accessTokenExpiresAt: number;
  refreshToken?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegistrationInput extends LoginInput {
  full_name: string;
  username: string;
}
