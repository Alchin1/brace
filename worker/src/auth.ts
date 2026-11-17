/** Shared-secret and QuickNode Streams HMAC checks. */

export const SINK_SECRET_HEADER = "x-brace-secret";

export function timingSafeEqualString(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  const n = Math.max(aa.length, bb.length);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < n; i++) {
    diff |= (aa[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0 && aa.length === bb.length;
}

export function checkSinkSecret(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  return timingSafeEqualString(header, secret);
}

/**
 * QuickNode Streams signs decompressed UTF-8 JSON as
 * HMAC-SHA256(securityToken, nonce + timestamp + body) hex,
 * sent in X-QN-Signature, with X-QN-Nonce and X-QN-Timestamp.
 * Official Streams webhook docs (security token) plus the
 * quiknode-labs/streams-webhook-validate-signature reference.
 */
export async function verifyQuickNodeSignature(opts: {
  nonce: string;
  timestamp: string;
  body: string;
  signature: string;
  securityToken: string;
}): Promise<boolean> {
  if (!opts.nonce || !opts.timestamp || !opts.signature || !opts.securityToken) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(opts.securityToken),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(opts.nonce + opts.timestamp + opts.body));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqualString(hex.toLowerCase(), opts.signature.trim().toLowerCase());
}

export async function readJsonBody(request: Request): Promise<string> {
  const encoding = (request.headers.get("content-encoding") || "").toLowerCase();
  if (encoding.includes("gzip") && request.body) {
    const decompressed = request.body.pipeThrough(new DecompressionStream("gzip"));
    return await new Response(decompressed).text();
  }
  return await request.text();
}
