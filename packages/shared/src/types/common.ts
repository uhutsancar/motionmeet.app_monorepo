export type EntityId = string;

export interface Timestamped {
  createdAt: string;
  updatedAt: string;
}

export interface ApiSuccess<T> {
  success: true;
  data?: T;
  message?: string;
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

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface OffsetPage<T> {
  items: T[];
  total: number | null;
  limit: number;
  skip: number;
}

export interface IdempotentRequest {
  operationId: string | null;
}
