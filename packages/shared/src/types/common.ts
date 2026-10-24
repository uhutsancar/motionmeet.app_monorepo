export type EntityId = string;

export interface Timestamped {
  createdAt: string;
  updatedAt: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export interface ApiFailure {
  success: false;
  message: string;
  error?: ApiErrorDetail;
  requestId?: string;
}

export interface IdempotentRequest {
  operationId: string | null;
}
