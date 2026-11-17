// Timeouts and plain-language errors for every request the browser makes
// (Solana devnet RPC, the relayer Worker, the app's own /api/ladder).

/** Devnet RPC calls give up after this long; the page then says so and retries on its next poll. */
export const RPC_TIMEOUT_MS = 10_000;
/** Relayer (history, actions) and /api/ladder calls give up after this long. */
export const RELAYER_TIMEOUT_MS = 10_000;

function withTimeoutSignal(init: RequestInit | undefined, ms: number): RequestInit {
  const timeout = AbortSignal.timeout(ms);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return { ...init, signal };
}

/** fetch that rejects with a TimeoutError if there is no answer within `ms`. */
export function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, ms = RELAYER_TIMEOUT_MS): Promise<Response> {
  return fetch(input, withTimeoutSignal(init, ms));
}

/** A fetch for web3.js `Connection({ fetch })`, so every RPC call has a timeout. */
export function timeoutFetch(ms = RPC_TIMEOUT_MS): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, withTimeoutSignal(init, ms))) as typeof fetch;
}

/** One short sentence for the user. Never shows the raw error text. */
export function friendlyNetError(e: unknown, service: string): string {
  const name = e instanceof Error || e instanceof DOMException ? e.name : "";
  const msg = e instanceof Error || e instanceof DOMException ? e.message : String(e);
  if (name === "TimeoutError" || name === "AbortError" || /timed? ?out|timeout|aborted/i.test(msg)) {
    return `${service} did not answer in time.`;
  }
  if (/\b429\b|too many requests|rate.?limit/i.test(msg)) return `${service} is busy right now.`;
  if (name === "TypeError" || /failed to fetch|fetch failed|network|load failed|ECONN|ENOTFOUND/i.test(msg)) {
    return `Could not connect to ${service}.`;
  }
  return `Something went wrong talking to ${service}.`;
}
