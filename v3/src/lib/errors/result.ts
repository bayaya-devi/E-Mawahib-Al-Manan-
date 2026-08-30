export type Result<Value, Failure> =
  | { ok: true; value: Value }
  | { ok: false; error: Failure };

export function success<Value>(value: Value): Result<Value, never> {
  return { ok: true, value };
}

export function failure<Failure>(error: Failure): Result<never, Failure> {
  return { ok: false, error };
}
