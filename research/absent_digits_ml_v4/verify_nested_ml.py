"""Integrity checks for the nested absent-digit ML study."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
RESULTS = HERE / "results.json"
PROTOCOL = HERE / "PROTOCOL.md"
REPORT = HERE / "REPORT.md"


def main() -> None:
    payload = json.loads(RESULTS.read_text(encoding="utf-8"))
    protocol_hash = hashlib.sha256(PROTOCOL.read_bytes()).hexdigest()
    assert payload["schemaVersion"] == 1
    assert payload["hashes"]["protocolSha256"] == protocol_hash
    assert payload["candidateConfigurations"] == 48
    assert payload["featureCount"] == 47
    assert payload["events"]["confirmation"] == sum(
        item["n"]
        for item in payload["marketGatedCandidate"]["blocks"].values()
    )
    assert payload["selectedConfig"] in {
        item["config"] for item in payload["selectionLeaderboard"]
    }
    assert payload["productionChanged"] is False
    assert payload["rawCandidate"]["promoted"] is False
    assert payload["marketGatedCandidate"]["promoted"] is False
    assert len(payload["enabledMarketSides"]) <= 24
    assert "**Reject the ML candidate" in REPORT.read_text(encoding="utf-8")
    for candidate in ("rawCandidate", "marketGatedCandidate"):
        for block in payload[candidate]["blocks"].values():
            assert block["n"] > 0
            assert 0 <= block["hits"] <= block["n"]
            assert 0 <= block["baselineHits"] <= block["n"]
            assert 0 <= block["pairedPValue"] <= 1
    print(json.dumps({
        "status": "verified",
        "selectedConfig": payload["selectedConfig"],
        "candidateConfigurations": payload["candidateConfigurations"],
        "confirmationEvents": payload["events"]["confirmation"],
        "promoted": False,
    }, indent=2))


if __name__ == "__main__":
    main()
