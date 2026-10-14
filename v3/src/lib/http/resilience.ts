type ResilientFetchOptions = RequestInit & { timeoutMs?: number; retries?: number; retryDelayMs?: number; circuitKey?: string };
type CircuitState = { failures: number; openedAt: number };
const circuits = new Map<string, CircuitState>();
const failureThreshold = 4;
const recoveryMs = 30_000;

export async function fetchWithResilience(input: string | URL | Request, options: ResilientFetchOptions = {}): Promise<Response> {
  const { timeoutMs = 6_000, retries = 1, retryDelayMs = 200, circuitKey, ...init } = options;
  const key = circuitKey ?? (typeof input === "string" ? new URL(input).hostname : input instanceof URL ? input.hostname : new URL(input.url).hostname);
  const circuit = circuits.get(key);
  if (circuit && circuit.failures >= failureThreshold && Date.now() - circuit.openedAt < recoveryMs) throw new Error("circuit_open");
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (response.status >= 500 && attempt < retries) {
        await response.body?.cancel();
        await delay(retryDelayMs * 2 ** attempt);
        continue;
      }
      if (response.ok || response.status < 500) circuits.delete(key); else recordFailure(key);
      return response;
    } catch (error) {
      lastError = error;
      recordFailure(key);
      if (attempt < retries) await delay(retryDelayMs * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("upstream_unavailable");
}

function recordFailure(key: string) { const previous = circuits.get(key); circuits.set(key, { failures: (previous?.failures ?? 0) + 1, openedAt: Date.now() }); }
function delay(milliseconds: number) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
export function resetCircuitsForTests(): void { circuits.clear(); }
