import type { InternalUser } from "../repositories/entities.js";

declare global {
  namespace Express {
    interface Request {
      /** Authenticated application routes establish this invariant via `protect`. */
      userId: string;
      sessionId?: string;
      dbUser?: InternalUser;
      requestId?: string;
    }
  }
}

export {};
