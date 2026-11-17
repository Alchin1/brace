import { describe, expect, test } from "vitest";
import { checkSinkSecret, SINK_SECRET_HEADER, verifyQuickNodeSignature } from "../src/auth.ts";

describe("sink shared secret", () => {
  test("accepts an exact header match and rejects missing or wrong values", () => {
    expect(checkSinkSecret("sekrit", "sekrit")).toBe(true);
    expect(checkSinkSecret("sekrit", "other")).toBe(false);
    expect(checkSinkSecret(null, "sekrit")).toBe(false);
    expect(checkSinkSecret("sekrit", undefined)).toBe(false);
    expect(SINK_SECRET_HEADER).toBe("x-brace-secret");
  });
});

describe("QuickNode Streams HMAC", () => {
  test("verifies nonce + timestamp + body with no separators, hex SHA-256 HMAC", async () => {
    const token = "qn-security-token-example";
    const nonce = "6f1c9a2e";
    const timestamp = "1760011200";
    const body = JSON.stringify({ data: [], metadata: { stream_id: "demo" } });
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(token),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(nonce + timestamp + body));
    const sig = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
    expect(
      await verifyQuickNodeSignature({ nonce, timestamp, body, signature: sig, securityToken: token }),
    ).toBe(true);
    expect(
      await verifyQuickNodeSignature({ nonce, timestamp, body, signature: sig, securityToken: "wrong" }),
    ).toBe(false);
    expect(
      await verifyQuickNodeSignature({
        nonce,
        timestamp,
        body: body + " ",
        signature: sig,
        securityToken: token,
      }),
    ).toBe(false);
  });
});
