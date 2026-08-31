import "server-only";

type LogContext = Record<string, string | number | boolean | null | undefined>;
const sensitiveKey = /password|secret|token|authorization|cookie|phone|salary|document|payload/i;

export function logServerError(code: string, error: unknown, context: LogContext = {}): void {
  const safeContext = Object.fromEntries(Object.entries(context).filter(([key]) => !sensitiveKey.test(key)));
  const detail = error instanceof Error ? { name: error.name, message: error.message.slice(0, 240) } : { name: "UnknownError" };
  console.error(JSON.stringify({ level: "error", code, detail, context: safeContext, occurredAt: new Date().toISOString() }));
}
