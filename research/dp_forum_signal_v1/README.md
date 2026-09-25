# Public-guess forward record

This records an anonymous aggregate of forum panel guesses **before** a market result. It does not issue a DP call. A public guess is not a wager, and there is no evidence the result setter reads this forum.

`forum_extract.py` reads Next.js page data from the [public guessing forum](https://dpboss.direct/matka-guessing-forum). It discards authors, email addresses, post IDs, and raw text. It recognizes canonical three-digit panels in posts tagged for a market and side, counts each distinct panel at most once per post, and ignores posts with more than 20 recognized panels. The parser is conservative but imperfect: free text and quoted material can still distort counts.

`capture.py` checks the chart before and after reading the forum and appends a snapshot to `forward_snapshots.jsonl` only if the target panel is absent and the fetch finishes before the scheduled pre-result cutoff. It stores page hashes but not the raw pages. For example:

```powershell
python research/dp_forum_signal_v1/capture.py madhur_day open --pages 3
```

`score_forward.py` later reads the provider's chart and appends the observed DP flag to `forward_scores.jsonl`. It skips unpublished results and does not change an existing score. Run it after results are posted:

```powershell
python research/dp_forum_signal_v1/score_forward.py
```

`daily_capture.py` waits for each configured Open and Close cutoff on one IST market date, runs the bounded capture, skips missed cutoffs, and exits after the final event. It can be checked without network access using `--dry-run`. A daily Codex heartbeat named **DP forward evidence** starts it at 09:00 IST and scores pending snapshots. The desktop host must be available for that local run; a sleeping or offline computer misses those events. The current day's helper was started after the first snapshot, so it covers only the remaining cutoffs.

The first captured snapshot is for Madhur Day Open on 2026-09-25 at 13:17 IST, before its configured 13:30 Open time. It contains nine target-tagged forum posts and two posts with recognized canonical panels. One snapshot cannot validate a relationship.

Known limits: the forum's posting and edit history is controlled by its publisher; the app's scheduled market times may differ from actual publication times; pages can shift while fetched; only the most recent three pages are sampled; guesses are not weighted by money; and chart outcomes can appear or change later. Keep model selection separate from future scoring. Require many independent dates and calls before using this signal in the app.
