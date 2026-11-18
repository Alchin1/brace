
import json
import math
from pathlib import Path
from bisect import bisect_left
from datetime import datetime, timezone

ASSETS = ["SOL", "BTC", "ETH", "XRP", "ZEC"]
DATA_DIR = Path("data")
YEAR_SECONDS = 31536000

HORIZONS = {
    "24H": 86400,
    "1H": 3600
}


def format_time(ts):
    return datetime.fromtimestamp(
        ts, timezone.utc
    ).isoformat()


def calculate_hit_rate(records, horizon):
    timestamps = [r["ts"] for r in records]

    total = 0
    hits_1 = 0
    hits_2 = 0
    pending = 0

    evaluated = []
    realised_times = []

    for record in records:
        target = record["ts"] + horizon

        index = bisect_left(timestamps, target)

        if index >= len(records):
            pending += 1
            continue

        actual = records[index]["spot"]
        spot = record["spot"]

        sigma = record["sigma_annual"] * math.sqrt(
            horizon / YEAR_SECONDS
        )

        lower_1 = spot * math.exp(-sigma)
        upper_1 = spot * math.exp(sigma)

        lower_2 = spot * math.exp(-2 * sigma)
        upper_2 = spot * math.exp(2 * sigma)

        total += 1
        evaluated.append(record["ts"])
        realised_times.append(records[index]["ts"])

        if lower_1 <= actual <= upper_1:
            hits_1 += 1

        if lower_2 <= actual <= upper_2:
            hits_2 += 1

    print(f"Evaluated forecasts: {total}")
    print(f"Pending forecasts: {pending}")

    if total == 0:
        print("Not enough mature forecasts yet.")
        return

    print(f"1 Sigma Hits: {hits_1}/{total}")
    print(f"2 Sigma Hits: {hits_2}/{total}")

    print(f"1 Sigma Hit Rate: {hits_1 / total:.2%}")
    print(f"2 Sigma Hit Rate: {hits_2 / total:.2%}")

    print(f"Start TS: {min(evaluated)}")
    print(f"End TS: {max(realised_times)}")

    print(f"Start UTC: {format_time(min(evaluated))}")
    print(f"End UTC: {format_time(max(realised_times))}")

    print(f"Last forecast TS: {max(evaluated)}")


def analyze(asset):
    path = DATA_DIR / f"{asset}.json"

    records = json.loads(
        path.read_text(encoding="utf-8")
    )

    records.sort(key=lambda r: r["ts"])

    print(f"\n========== {asset} ==========")
    print(f"Total records: {len(records)}")

    for label, horizon in HORIZONS.items():
        print(f"\n--- {label} HIT RATE ---")
        calculate_hit_rate(records, horizon)


def main():
    print("=== BRACE TRACKER ANALYTICS ===")

    for asset in ASSETS:
        try:
            analyze(asset)
        except Exception as error:
            print(f"[ERROR] {asset}: {error}")


if __name__ == "__main__":
    main()
