import { afterEach, describe, expect, test, vi } from "vitest";
import { GET } from "../app/api/ladder/route";
import { LADDER_TIMEOUT_MS } from "./timeouts";

afterEach(() => vi.unstubAllGlobals());

describe("/api/ladder", () => {
  test("bad ticker is 400 with reason not-found", async () => {
    const res = await GET(new Request("http://x/api/ladder?ticker=bad!"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ quotes: [], reason: "not-found" });
  });

  test("Gemini fetch carries a timeout signal", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", async (_u: unknown, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return Response.json({ data: [] });
    });
    const res = await GET(new Request("http://x/api/ladder?ticker=SOL2611172200"));
    expect(await res.json()).toMatchObject({ reason: "not-found" });
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(LADDER_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
  });

  test("Gemini down or timing out returns unavailable, not a crash", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    const res = await GET(new Request("http://x/api/ladder?ticker=SOL2611172200"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ quotes: [], reason: "unavailable" });
  });
});
