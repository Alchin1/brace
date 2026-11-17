// Live Gemini quotes for one ladder, for the chart dots. Server side so the browser
// never depends on Gemini's CORS policy. Returns only real two-sided "above" quotes;
// if the event is gone (expired) or the fetch fails, returns an empty list with a reason.

const EVENTS_URL = "https://api.gemini.com/v1/prediction-markets/events?status=active&limit=200&category=crypto";

type GeminiContract = {
  strike?: { type?: string; value?: string };
  prices?: { bestBid?: string | null; bestAsk?: string | null };
};
type GeminiEvent = { ticker?: string; contracts?: GeminiContract[] };

export type LadderQuote = { strike: number; bid: number; ask: number };
export type LadderResponse = { ticker: string; quotes: LadderQuote[]; reason?: "not-found" | "unavailable" };

function json(body: LadderResponse, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "public, max-age=15, s-maxage=30" } });
}

export async function GET(req: Request) {
  const ticker = new URL(req.url).searchParams.get("ticker") ?? "";
  if (!/^[A-Z0-9]{3,32}$/.test(ticker)) return json({ ticker, quotes: [], reason: "not-found" }, 400);

  let events: GeminiEvent[];
  try {
    const res = await fetch(EVENTS_URL, { next: { revalidate: 30 } });
    if (!res.ok) return json({ ticker, quotes: [], reason: "unavailable" });
    const body = (await res.json()) as { data?: GeminiEvent[] };
    events = Array.isArray(body.data) ? body.data : [];
  } catch {
    return json({ ticker, quotes: [], reason: "unavailable" });
  }

  const ev = events.find((e) => e.ticker === ticker);
  if (!ev) return json({ ticker, quotes: [], reason: "not-found" });

  const quotes: LadderQuote[] = [];
  for (const c of ev.contracts ?? []) {
    if ((c.strike?.type ?? "").toLowerCase() !== "above") continue;
    const strike = Number(c.strike?.value);
    const bid = Number(c.prices?.bestBid);
    const ask = Number(c.prices?.bestAsk);
    if (!(strike > 0) || !(bid > 0) || !(ask > 0) || ask < bid || ask > 1) continue;
    quotes.push({ strike, bid, ask });
  }
  quotes.sort((a, b) => a.strike - b.strike);
  return json({ ticker, quotes });
}
