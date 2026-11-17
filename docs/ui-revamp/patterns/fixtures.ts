/**
 * Real snapshot of the live relayer, for layout work only.
 * Captured from https://brace-relayer.ohjaye0.workers.dev/history at 2026-11-18 00:15 Lagos (UTC+1):
 * last confident reading per asset, and effective_ltv every 30 minutes over the 12 hours before it.
 * Never render these in the app: production must read the live feed. They exist so the patterns
 * render with honest numbers in a demo, not invented ones.
 */
export type FeedSnapshot = {
  symbol: "SOL" | "BTC" | "ETH" | "XRP" | "ZEC";
  name: string;
  limitPct: number;
  volPct: number;
  spot: number;
  postedAt: number;
  tx: string;
  sparkLimitPct: number[];
};

export const SNAPSHOT_CAPTURED_AT = 1794957323;

export const SNAPSHOT: FeedSnapshot[] = [
  {
    "symbol": "SOL",
    "name": "Solana",
    "limitPct": 69.2,
    "volPct": 85.8,
    "spot": 75.302,
    "postedAt": 1794957323,
    "tx": "39pbCnGHXZwhg2jU4TQ5TrLpSdjgKNJ5W4xXMwPJJ95HCtVFCy8NbJiMxJdQeuxjxkDTtpMAAU7t9BVFaoba2y8M",
    "sparkLimitPct": [
      68.4,
      68.6,
      69.0,
      68.5,
      68.8,
      68.8,
      68.8,
      68.8,
      69.0,
      68.5,
      68.5,
      67.5,
      69.5,
      67.5,
      67.5,
      70.3,
      69.7,
      69.4,
      69.2,
      71.4,
      71.5,
      70.1,
      69.9,
      69.2
    ]
  },
  {
    "symbol": "BTC",
    "name": "Bitcoin",
    "limitPct": 73.9,
    "volPct": 48.7,
    "spot": 65061.71,
    "postedAt": 1794957323,
    "tx": "39pbCnGHXZwhg2jU4TQ5TrLpSdjgKNJ5W4xXMwPJJ95HCtVFCy8NbJiMxJdQeuxjxkDTtpMAAU7t9BVFaoba2y8M",
    "sparkLimitPct": [
      75.0,
      73.3,
      75.0,
      73.4,
      73.9,
      73.5,
      72.3,
      73.1,
      71.8,
      73.0,
      69.0,
      71.9,
      70.6,
      72.3,
      73.6,
      73.2,
      74.6,
      72.8,
      75.0,
      73.0,
      72.4,
      73.9,
      73.9,
      73.6,
      73.9
    ]
  },
  {
    "symbol": "ETH",
    "name": "Ether",
    "limitPct": 70.2,
    "volPct": 77.9,
    "spot": 1827.81,
    "postedAt": 1794957323,
    "tx": "39pbCnGHXZwhg2jU4TQ5TrLpSdjgKNJ5W4xXMwPJJ95HCtVFCy8NbJiMxJdQeuxjxkDTtpMAAU7t9BVFaoba2y8M",
    "sparkLimitPct": [
      68.4,
      68.8,
      67.6,
      68.5,
      69.0,
      70.1,
      70.2,
      68.8,
      69.2,
      69.9,
      68.6,
      70.0,
      68.9,
      69.5,
      71.2,
      70.8,
      69.6,
      70.3,
      70.2
    ]
  },
  {
    "symbol": "XRP",
    "name": "XRP",
    "limitPct": 69.5,
    "volPct": 83.6,
    "spot": 0.98559,
    "postedAt": 1794957323,
    "tx": "39pbCnGHXZwhg2jU4TQ5TrLpSdjgKNJ5W4xXMwPJJ95HCtVFCy8NbJiMxJdQeuxjxkDTtpMAAU7t9BVFaoba2y8M",
    "sparkLimitPct": [
      68.8,
      68.9,
      69.0,
      68.4,
      68.6,
      68.7,
      69.1,
      68.6,
      68.2,
      69.2,
      68.8,
      69.0,
      68.1,
      69.2,
      71.4,
      71.3,
      70.3,
      70.4,
      69.5
    ]
  },
  {
    "symbol": "ZEC",
    "name": "Zcash",
    "limitPct": 62.3,
    "volPct": 141.1,
    "spot": 968.22,
    "postedAt": 1794957324,
    "tx": "4E7yR86rPZ8GcaXWa6vvmDXWcbNZyxfhvdWMgUgx7ghHt6AENnCmDAT8RUuJdWduuStt7bigUSJtdZLFvj5JTWL1",
    "sparkLimitPct": [
      59.7,
      61.6,
      59.7,
      59.0,
      57.9,
      60.2,
      57.5,
      56.4,
      56.5,
      56.5,
      53.7,
      56.3,
      55.2,
      55.5,
      57.3,
      54.9,
      57.3,
      59.2,
      59.5,
      62.7,
      62.3,
      60.6,
      63.8,
      62.3
    ]
  }
];
