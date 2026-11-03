# Supreme market integration

Supreme Day is selectable in Analysis V1 and V2. Its own history is loaded only
when selected, alongside the twelve original pooled-DP inputs. Loading any original
market does not fetch or depend on either Supreme feed. Model coefficients,
combination policies and DP pool membership are unchanged.

Supreme Night is listed in the Night session with predictions unavailable. The
November 3, 2026 audit found that the preferred chart stops on October 18 and
disagrees with another chart on 39 overlapping completed dates. The sequence is
displaced by one day. A recent HTTP fetch timestamp cannot resolve that conflict.
The loader also enforces this restriction, including for cached history.

Both chart paths use the existing trusted source:

- `https://dpboss.tax/panel-chart-record/supreme-day.php`
- `https://dpboss.tax/panel-chart-record/supreme-night.php`

The corresponding Boston URLs are recorded in `links.txt` and the scraper map.
The new schedules are Day 15:35/17:35 and Night 20:45/22:45, Asia/Kolkata. Supreme
Night has night-market classification; neither market is assigned a measured
volume tier or a liquidity predecessor. Supreme Day displays volume as Unrated.
New-market history must satisfy the scheduled-result freshness checks and contain
a complete draw less than three calendar days old. The same checks apply to a
saved snapshot used after a network failure. Original-market freshness behavior
is preserved.

## Enabling Supreme Night later

1. Reconcile the September 9 onward date discrepancy with dated result evidence.
   Do not shift dates or append the conflicting alternate chart by assumption.
2. Obtain a complete, current 28-month preferred-source history. Any independent
   supplement must pass the existing exact-overlap acceptance rule.
3. Replay both models with the final night classification and fixed shortlist
   counts; distinguish before-Open and after-Open Close forecasts.
4. Remove its issue in `src/lib/analysis-markets.ts`, enable its research scraper
   entry, and rerun integration, model parity, freshness and browser checks.

This change adds Analysis markets. Live Results and notifications use a separate
Supabase market registry and are not extended by this release.

## Verification

```powershell
node scripts/verify-supreme-markets.cjs
node scripts/verify-supreme-markets-browser.cjs
node scripts/verify-analysis-versions.cjs
node scripts/verify-reliability.cjs
node scripts/verify-market-history-freshness.cjs
npx tsc --noEmit
npm run lint
npm run build
```

The browser check accepts `PLAYWRIGHT_MODULE`, `TEST_URL`, and
`VERIFY_SCREENSHOT_DIR` in the same way as the existing browser verification.
