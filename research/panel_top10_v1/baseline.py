"""Current production panel accuracy over the last 7 / 30 / 90 calendar days."""

from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
END = "2026-09-30"
WINDOWS = {"7d": "2026-09-24", "30d": "2026-09-01", "90d": "2026-07-03"}


def main() -> None:
    ledger = json.loads((HERE / "production_replay.json").read_text())["ledger"]
    out = {}
    for name, start in WINDOWS.items():
        rows = [r for r in ledger if start <= r["date"] <= END]
        out[name] = {"n": len(rows)}
        for side, key in (("open", "prodOpen"), ("close", "prodClose")):
            for k in (10, 40):
                hits = sum(1 for r in rows if r[side] in r[key][:k])
                out[name][f"{side}Top{k}"] = {"hits": hits, "rate": round(100 * hits / len(rows), 2)}
        print(name, json.dumps(out[name]))
    (HERE / "baseline.json").write_text(json.dumps(out, indent=2) + "\n")


if __name__ == "__main__":
    main()
