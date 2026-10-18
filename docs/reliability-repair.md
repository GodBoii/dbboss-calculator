# Reliability repair plan and verification

The repair preserves the fitted V1 and V2 coefficients and shortlist sizes. The app remains a dark mobile calculator with the existing Analysis, Results, Profile, copy controls, and Open inputs. Loading, recovery, stale metrics, and network failures must remain explicit. All market dates use Asia/Kolkata regardless of the phone's timezone.

## Sequence

1. Freeze the unmodified scrape API output for all twelve markets. Replay both current models before production edits, through October 17, 2026 IST, over inclusive 7, 30, 90, and 180 calendar-day windows. Use only earlier dates for training. Report pre-Open and known-Open Close separately. Keep every evaluated event and forecast fingerprint.
2. Validate dates, weekdays, canonical panels, and derived Sutta/Jodi at the data boundary. Key records by market and actual ISO date. Merge agreeing partial records and identical duplicates; reject conflicting panels. Replace complete market snapshots in one IndexedDB transaction only after successful network fetch and validation. Preserve old data if any fetch or write fails. Recover an invalid legacy cache by fetching its market again.
3. Load a complete, fixed set of all twelve histories required by the pooled DP model. Do not let browsing history select the pool. Remove the legacy-only Sutta source-fetch dependency. Do not silently omit a failed pooled source. Permit an offline fallback only when the entire validated saved snapshot meets freshness checks, and preserve its original timestamp.
4. Centralize IST date, weekday, day-of-month, and hour helpers. Keep prediction target and training cutoff consistent across panel, Sutta, present/absent, DP, backtest, and live-result paths. A stale partial Open must never become today's declared Open.
5. Cancel superseded fetches and workers. Run historical metrics in workers and publish live predictions before metrics. Keep existing V1/V2 switching, count selection, known Open, and copying behavior. Replace obsolete confidence numbers with metrics for the actual displayed contract.
6. Make notification delivery retryable without repeating successful recipients. Treat expired subscriptions as terminal, temporary delivery failures as pending, and check database writes. Recover missing result events from saved results. Keep source confirmations and delivery state separate.
7. Run the same frozen replay again and compare all 96 market/version/window combinations, denominators, per-event predictions, and accuracy. Investigate every difference rather than tune against these outcomes. Run focused storage/network/timezone/worker tests, existing model checks, lint, type checks, production build, and mobile/desktop browser flows.
8. Synchronize the app/PWA release version. Commit each changed file separately on main, preserve pre-existing local changes, and push coherent verified batches.

## Accuracy interpretation

These are retrospective regression checks of already fitted models, not fresh forward evidence or a claim that bug fixes improve betting accuracy. The frozen raw source, actual outcomes, calendar windows, top-ten panels, top-six Suttas and 36-Jodi grid stay identical between runs. No unavailable prediction may quietly disappear from a denominator. Source corrections and event-boundary fixes require explicit attribution if they change a forecast.

The replay artifacts and detailed comparison live under `backtest_reports/2026-10-18/reliability/`. The frozen source includes its fetch timestamp and source audits; each replay records its SHA-256.
