import "server-only";

type LogContext = Record<string, unknown>;
type LogLevel = "info" | "warn" | "error";
const sensitiveKey = /password|secret|token|authorization|cookie|phone|salary|document|payload/i;

export function logServerError(code: string, error: unknown, context: LogContext = {}): void {
  const detail = error instanceof Error ? { name: error.name, message: error.message.slice(0, 240) } : { name: "UnknownError" };
  writeLog("error", code, { ...context, detail });
}

export function logServerInfo(code: string, context: LogContext = {}): void {
  writeLog("info", code, context);
}

export function logServerWarning(code: string, context: LogContext = {}): void {
  writeLog("warn", code, context);
}

export function requestId(request: Request): string {
  return request.headers.get("x-request-id")?.slice(0, 128) || crypto.randomUUID();
}

function writeLog(level: LogLevel, code: string, context: LogContext): void {
  const entry = JSON.stringify({ level, code, context: sanitize(context), occurredAt: new Date().toISOString() });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitize(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !sensitiveKey.test(key)).map(([key, item]) => [key, sanitize(item, depth + 1)]));
  }
  if (typeof value === "string") return value.slice(0, 500);
  return value;
}
