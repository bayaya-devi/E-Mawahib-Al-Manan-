export const APP_ERROR_CODES = [
  "AUTH_INVALID_CREDENTIALS", "AUTH_SUSPENDED", "NOT_AUTHORIZED", "VALIDATION_ERROR",
  "NETWORK_ERROR", "CONFLICT", "RATE_LIMITED", "RESOURCE_NOT_FOUND", "UPLOAD_TOO_LARGE",
  "SYNC_FAILED", "SERVICE_UNAVAILABLE",
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export class AppError extends Error {
  constructor(public readonly code: AppErrorCode, message: string, public readonly retryable = false) {
    super(message);
    this.name = "AppError";
  }
}
