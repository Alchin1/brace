/** Integer-to-decimal conversion for the accuracy-tracker JSON contract. Avoids float rounding on the way in. */

export function scaledToNumber(value: bigint | number, scale: number): number {
  const n = typeof value === "bigint" ? value : BigInt(value);
  const neg = n < 0n;
  const v = neg ? -n : n;
  const base = 10n ** BigInt(scale);
  const whole = v / base;
  const frac = (v % base).toString().padStart(scale, "0").replace(/0+$/, "");
  const s = frac.length ? `${whole}.${frac}` : `${whole}`;
  return Number(neg ? `-${s}` : s);
}

export function e6ToNumber(e6: bigint | number): number {
  return scaledToNumber(e6, 6);
}

export function bpsToRatio(bps: number): number {
  return scaledToNumber(bps, 4);
}

export function kToNumber(kX100: number): number {
  return scaledToNumber(kX100, 2);
}
