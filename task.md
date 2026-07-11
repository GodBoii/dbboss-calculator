# 🎯 Quality Prompt: Deep Historical Analysis & Prediction Improvement for DBBoss

> Copy-paste this prompt as a single message to an AI assistant with full access to the codebase and data files.

---

## Context: What This Project Is

I have a **Satta Matka prediction engine** — a Next.js app that scrapes historical panel chart data from `dpbossss.boston` (11 major markets), stores it in IndexedDB, and runs a scoring-based prediction engine that recommends which 3-digit panels are most likely to appear next for each market's Open and Close draws.

### ⚠️ MANDATORY: Use Only Last 2 Years of Data (July 2024 – Present)

**DO NOT use data older than 2 years.** The full dataset goes back to 2013, but data before ~mid-2024 is **actively harmful** to predictions because:

1. **The market fundamentally changed** — Pre-2024 Matka operated differently. Different operators, different betting volumes, different player demographics (pre-smartphone era vs mobile-first era). The operator's algorithm, liability thresholds, and behavioral patterns have all shifted.
2. **Old data introduces noise, not signal** — When we trained on 13 years, the model learned patterns from a market that no longer exists. The 2-year structural shift analysis already proved this: day DP rates went UP by 4.5% and night close DP rates went DOWN by 4.6% compared to the all-time average. Using old data actively degrades predictions.
3. **The operator adapts** — Any pattern that existed in 2015-2022 has been observed by players and countered by operators. Only recent patterns (last 2 years) reflect the operator's *current* strategy.
4. **Statistical proof** — Our own backtest showed rules trained on all-time data had ZERO walk-forward validated DP rules survive, while the 2-year window produced actionable signals.

**When filtering**: Use records with dates ≥ July 2024 (or the last 730 days from today). If the CSV contains older data, discard it. If scraping fresh data, only process rows within this window. All base rates, transition matrices, frequency counts, and pattern mining must use this 2-year window exclusively.

### How Satta Matka Works (essential for analysis)

Each market conducts **one draw per day** in two phases:
- **Open Draw**: Produces a 3-digit **Open Panel** (e.g., `368`) → digits sum mod 10 = **Open Sutta** (e.g., 7)
- **Close Draw** (2 hours later): Produces a 3-digit **Close Panel** (e.g., `279`) → digits sum mod 10 = **Close Sutta** (e.g., 8)
- **Jodi** = Open Sutta + Close Sutta combined as 2 digits (e.g., `78`)
- Full result format: `368-78-279` (Open Panel – Jodi – Close Panel)

Panels are classified by digit uniqueness:
- **SP (Single Panna)**: All 3 digits different — 120 possible panels (e.g., 123, 259, 468)
- **DP (Double Panna)**: Exactly 2 digits same — 90 possible panels (e.g., 112, 338, 550)
- **TP (Triple Panna)**: All 3 digits same — 10 possible panels (000–999)
- Total unique panels: **220**

**Critical insight**: This is NOT random. The operator (house) sees all bets placed and selects the result that **minimizes their payout liability**. Historical data proves this (Triples suppressed 20× below random probability, systematic DP suppression from 40.9% structural rate to 24.4% actual).

### The 11 Markets Tracked (in chronological order)

**Day Session**: Sridevi → Time Bazar → Madhur Day → Milan Day → Rajdhani Day → Kalyan  
**Night Session**: Sridevi Night → Kalyan Night → Madhur Night → Milan Night → Rajdhani Night → Main Bazar

Money flows chronologically — winnings from earlier markets feed into bets on later markets (the **Liquidity Chain**).

---

## My Current Prediction Engine (v3)

**Architecture**: `src/lib/predictor/` directory containing:
- `analyze.ts` — Main orchestrator: calls all sub-modules, produces `PredictionResult`
- `scoring.ts` — Core scoring: 7 factors per panel (Recency, Cooldown, Sequential penalty, Lucky digit penalty, Triple penalty, Sutta saturation, Day-of-week boost)
- `dp-kind-context.ts` — Research-backed DP/SP bias signals (weekday, digit triggers, cross-market cascades, night→day signals, 2-year structural shift)
- `jodi.ts` — Real-time close prediction using known Open result + Jodi liability analysis + digit-clean filtering
- `market-config.ts` — Volume tiers, liquidity flow map, weekday DP bias tables
- `panel-utils.ts` — Panel universe generation, classification (SP/DP/TP), sutta calculation
- `calibration.ts` — Per-market model calibration (panel/sutta hit rates)
- `sutta-signals.ts` — Sutta drought tracking with rubber-band curve
- `backtest.ts` — Walk-forward backtesting: trains on data before each test day, evaluates predictions vs actual results

### What the Engine Currently Scores

For all 220 panels, it computes:
```
finalScore = recencyScore − cooldownPenalty − seqPenalty − luckyPenalty − triplePenalty − saturationPenalty + dayBoost − jodiPenalty
```
Returns top 30 panels for Open, Close, DP-Open, DP-Close, and Jodi-adjusted Close.

### Known DP Pattern Rules Already Implemented

1. **Weekday DP bias** (Sunday ×0.75, Tuesday ×1.10)
2. **Sutta-3 blind-spot fix** (prev close sutta=3 → ×1.40 DP boost)
3. **Market-specific digit triggers** (Kalyan digit-8, Night markets digit-3, Milan Day digit-1, etc.)
4. **Double digit echo** (open dpDigit=2 + close dpDigit=4 → ×1.30)
5. **Source market digit triggers** (Time Bazar←Sridevi digit-6, Night←source digit-3)
6. **Night→Day DP count** (prev night 1 open DP → ×1.28 warm-up)
7. **Dry-day cascade** (0 earlier DPs today → ×0.84 or ×0.72 on Sunday)
8. **Same-market open→close kind carry** (open DP → ×1.10, open SP → ×0.92)
9. **2-year structural shift** (day DP up ×1.04, night close down ×0.96)
10. **Night gold rule** (own digit-3 + source close sutta=8 → ×1.28)
11. **Digit-clean close filter** (no shared digits with open → +18 boost, both shared → −45 penalty)

### Current Backtest Results (what I know about performance)

Walk-forward validation (train before each test day, test on that day, last 30 days):
- **Panel hit rates**: Some improvement over random (13.6% baseline for top-30 = 30/220)
- **Sutta hit rates**: Meaningfully above random
- **SP prediction rules**: 15+ rules survived walk-forward with 84–94% precision and positive lift
- **DP prediction rules**: No single rule survived walk-forward with sufficient support (the operator adapts)
- **Jodi model**: Shows improvement in close panel ranking when open is known

---

## What I Want You To Do

### Part 1: Deep Historical Data Analysis (Last 2 Years Only)

Scrape fresh data from all 11 markets using the trusted URLs at `dpbossss.boston/panel-chart-record/{market}.php` or use the existing scraped CSV at `scraper/data/panel_data_20260517_205722.csv`. **Filter to only the last 2 years of data** (≥ July 2024). Discard everything older — it represents a different market era and will poison the analysis.

**Run these analyses with step-by-step reasoning:**

#### A. Last 30 Days Performance Audit
1. **Re-run the backtest** (`src/lib/backtest.ts` logic) for all 11 markets over the last 30 days
2. For each market × position (open/close), report:
   - Panel top-3/10/30 hit rates vs random baseline (13.6%)
   - Sutta top-3/10/30 hit rates vs random baseline (30%)
   - Kind (SP/DP) prediction accuracy
   - Average rank of the actual panel in our top-30 list
3. Compare to the existing backtest report at `backtest_reports/2026-06-28/sp-dp-pattern-research.md`
4. **Calculate our actual prediction quality**: If a bettor followed our top-10 picks, what would their win rate be? Compare that to placing random bets.

#### B. DP Frequency & Timing Analysis
1. For each market, calculate: how many DPs came in the last 30 days vs the 2-year average?
2. Within the 2-year window, is there a continuing trend? (first half vs second half — is DP rate still shifting?)
3. **Daily DP clustering**: In the last 30 days, how many were "pure SP days" (0 DPs) vs "hot days" (4+ DPs)?
4. **Current drought states**: For each market × position, what's the current DP gap (draws since last DP)? Flag any at p90+ (overdue).

#### C. Pattern Mining — Find What Works NOW

Using the last 90 days as validation data and the rest of the 2-year window as training (do NOT use data older than 2 years for training):

**C1. Weekday patterns (deep dive)**:
- For today's weekday (use current day), what is the DP rate per market?  
- Does "if today is first-week Saturday, check last month's first-week Saturday" actually work? Test with the data.
- Check: does the same weekday in the same week-of-month show DP correlation?

**C2. Even/Odd number patterns**:
- Do panels with all-even digits (e.g., 248, 260, 046) appear at different rates on specific days?
- Do panels with all-odd digits (135, 179, 359) show weekday preferences?
- Does the open panel's even/odd composition predict the close panel's even/odd composition?

**C3. Sutta transition patterns**:
- Build a 10×10 transition matrix: Given today's open sutta = X, what is the probability of close sutta = Y?
- Build a same-market day-over-day transition matrix: Given yesterday's close sutta = X, what is today's open sutta probability for each Y?
- Are there forbidden transitions (operator never follows sutta X with sutta Y)?

**C4. Panel digit frequency analysis**:
- Which specific digits are "hot" in the last 30 days (appearing more than expected)?
- Which digits are "cold" (appearing less than expected)?
- Does the digit temperature predict next-day panel composition?

**C5. Cross-market same-day correlation (deep)**:
- If Sridevi open = DP today, what's the probability of Kalyan open = DP today? (check all market pairs)
- If the first 3 markets today are all SP, what's the probability of the remaining markets being SP?
- Build a full cross-market DP correlation matrix for today's same-day panels.

**C6. Jodi patterns**:
- Which jodis have appeared most in the last 30 days across all markets?
- Is there a "jodi rotation" pattern? (e.g., does jodi 45 this week predict jodi 54 next week?)
- When jodi is a double (11, 22, 33...), what happens to the next day's open sutta?

**C7. Panel repeat and echo patterns**:
- If a specific panel (e.g., 368) appeared in Kalyan today, within how many days does it tend to re-appear in:
  (a) the same market? (b) a different market?
- Do panels "echo" across the liquidity chain? (Sridevi's panel appearing in Time Bazar within 2 days)

**C8. Monthly cycle and date-specific patterns**:
- Group results by day-of-month (1st, 2nd, ..., 31st) — any statistically significant DP rate differences?
- First week vs last week of month: DP rate difference?
- Is there a month-end "reset" pattern where certain suttas cluster?

**C9. Open→Close digit carry (with the actual last 30 days)**:
- Verify the digit-clean close signal (30.3% DP when no shared digits) is still holding
- For each market individually, does this signal strength vary?
- NEW: Check if the MIDDLE digit of the open panel carries into the close panel

**C10. "Operator signature" detection**:
- Does the operator have "favorite" panels that appear more often than statistical randomness allows?
- Build a per-market "operator profile": top 10 most frequent panels, top 10 most avoided panels
- Has the operator's profile changed in the last 90 days vs the 13-year average?

#### D. Advanced Theory Testing

**D1. Markov chain model**: Treat the sequence of suttas (0-9) as a Markov chain. Compute the transition matrix from the full dataset. Does it have a stationary distribution? Is it different from uniform? What does the Markov chain predict for tomorrow?

**D2. Information theory**: Compute the Shannon entropy of the sutta distribution for each market. Higher entropy = closer to random. Lower entropy = more predictable. Which market has the lowest entropy (most predictable)?

**D3. Autocorrelation**: Compute the autocorrelation of the sutta time series at lags 1, 2, 3, 7 (same weekday), 14, 30. Is there any significant serial correlation that we're not exploiting?

**D4. Conditional probability trees**: For each market, build a decision tree:
```
IF weekday = Tuesday
  AND prev_close_sutta = 3
    AND prev_night_dp_count = 1
      → DP probability = ?%, top predicted panels = [...]
```
Find the 10 strongest branches.

**D5. Anomaly detection**: In the last 30 days, were there any results that were EXTREMELY unlikely given our model? (i.e., a panel we scored in the bottom 20 that actually appeared). What conditions caused the surprise? Can we learn from it?

---

### Part 2: Synthesize Findings into Actionable Improvements

After completing all analyses, provide:

1. **A ranked list of the top 10 pattern discoveries** sorted by prediction improvement potential, with:
   - Statistical evidence (sample size, precision, lift over baseline)
   - Walk-forward validation results
   - Whether it survived operator adaptation

2. **Specific scoring formula changes**: Exactly what to add/modify in `scoring.ts`, `dp-kind-context.ts`, and `jodi.ts` to incorporate the new patterns. Provide the mathematical formulas and weights.

3. **New signals to add to `dp-kind-context.ts`**: Any new DP/SP bias multipliers with their conditions and values.

4. **Updated transition matrices/lookup tables**: If Markov chains or conditional probabilities prove useful, provide the exact tables to hardcode.

5. **Per-market calibration adjustments**: If some markets have shifted their operator behavior recently, provide updated calibration values.

6. **Prediction for today**: Based on all analysis, for each of the 11 markets, provide:
   - Predicted kind (SP/DP) for open and close, with confidence
   - Top 5 recommended open panels
   - Top 5 recommended close panels
   - Favored jodis
   - Suttas to target and suttas to avoid
   - Any special signals or alerts

---

### Part 3: Analysis Report Format

Present all findings in a structured markdown report with:
- Clear section headers
- Data tables with sample sizes
- Statistical significance indicators
- Before/after comparisons where applicable
- Mermaid diagrams for complex relationships
- Specific code-level recommendations

**REASON STEP BY STEP. THINK FOR LONGER. Show your statistical calculations. Don't skip the math. Every claim must have a number behind it.**

---

## Key Files to Reference

| File | Purpose |
|------|---------|
| `src/lib/predictor/scoring.ts` | Core panel scoring — 7 factors, tuning constants |
| `src/lib/predictor/dp-kind-context.ts` | DP/SP bias signals — weekday, digits, cross-market |
| `src/lib/predictor/jodi.ts` | Jodi liability model — real-time close prediction |
| `src/lib/predictor/analyze.ts` | Main analysis orchestrator |
| `src/lib/predictor/market-config.ts` | Market tiers, liquidity map, weekday bias tables |
| `src/lib/backtest.ts` | Walk-forward backtesting engine |
| `how_the_game_works.md` | Complete Satta Matka mechanics explained |
| `DP-pattern.md` | 739-line deep DP pattern analysis (42,548 panels) |
| `prediction.md` | Full prediction engine v3 documentation |
| `analysis.md` | Game-theory intelligence document |
| `backtest_reports/2026-06-28/sp-dp-pattern-research.md` | Latest backtest with walk-forward validated rules |
| `scraper/data/panel_data_20260517_205722.csv` | 21.7 MB raw historical data |
| `links.txt` | Trusted data source URLs (dpbossss.boston) |

## Data Source URLs (for fresh scraping)

```
https://dpbossss.boston/panel-chart-record/sridevi.php
https://dpbossss.boston/panel-chart-record/time-bazar.php
https://dpbossss.boston/panel-chart-record/madhur-day.php
https://dpbossss.boston/panel-chart-record/milan-day.php
https://dpbossss.boston/panel-chart-record/rajdhani-day.php
https://dpbossss.boston/panel-chart-record/kalyan.php
https://dpbossss.boston/panel-chart-record/sridevi-night.php
https://dpbossss.boston/panel-chart-record/kalyan-night.php
https://dpbossss.boston/panel-chart-record/madhur-night.php
https://dpbossss.boston/panel-chart-record/milan-night.php
https://dpbossss.boston/panel-chart-record/rajdhani-night.php
https://dpbossss.boston/panel-chart-record/main-bazar.php
```

## Critical Constraints

1. **STRICT 2-YEAR DATA WINDOW** — Use ONLY data from the last 2 years (≥ July 2024). Do NOT use older data for training, base rates, pattern mining, or any calculations. Old data represents a fundamentally different market and will degrade every analysis.
2. **Do NOT edit any code** — this is an analysis-only task
3. **All claims must have statistical backing** — sample size, precision, confidence interval
4. **Walk-forward validation is mandatory** — any pattern must be tested on out-of-sample data (last 90 days), with training only on the prior portion of the 2-year window
5. **The operator adapts** — even patterns from 6 months ago may have weakened. Test recency.
6. **Account for Sunday suppression** — Sunday has fundamentally different DP rates
7. **Track which patterns are already implemented** — don't re-discover what's in the code
8. **Per-market analysis** — Don't just aggregate across markets. Each market has its own operator behavior. Report findings per-market.

---

## 💡 Ideas & Creative Approaches to Try

Beyond the structured analysis above, here are specific creative ideas to explore. These are the kinds of hidden, complex, and simple patterns that can give us an edge:

### Temporal & Calendar Ideas

1. **"Week Number" Pattern**: Assign each week a number (1-52). Do certain week numbers historically produce more DPs? Is week 27 different from week 3? Check if the operator follows a seasonal budget cycle.

2. **"Payday Cascade" Deep Test**: India's government employees get paid on the 1st. Private sector often pays 25th-30th. Test DP rates for days 1-3 vs 25-28 vs 15-17 (mid-month dry period). The operator may be more aggressive with DP on specific salary cycles.

3. **"Monday Morning Recovery" Pattern**: After a Sunday (lowest DP rate), does Monday morning's first market (Sridevi) show elevated DP as pent-up demand releases? Test the last 2 years specifically.

4. **"Festival Calendar" Effect**: Major Indian festivals (Diwali, Holi, Eid, Ganesh Chaturthi) bring massive betting volume. Does the operator change behavior around these dates? Even ±3 days around festivals.

5. **"End-of-Week Energy" Theory**: Track the total DP count Monday→Saturday within each week. Does the cumulative count follow a predictable arc? (e.g., low Mon, peaks Tue/Wed, tapers Fri/Sat)

### Number Theory & Mathematical Ideas

6. **"Sum Parity" Pattern**: Open panel digit sum is either even or odd. Does the parity of the open sum predict the close sum parity? (e.g., even open sum → odd close sum more likely?)

7. **"Digit Position Analysis"**: Track the first digit, middle digit, and last digit of panels separately. Does digit "5" appear more as a first digit than a last digit? Does position-specific frequency differ from overall frequency?

8. **"Panel Distance" Metric**: Define a distance between two panels (e.g., Manhattan distance between digit vectors). When a panel appears, how far away (by this metric) is the next day's panel? Are close-distance repeats suppressed?

9. **"Modular Arithmetic" Patterns**: Check if (today's sutta + yesterday's sutta) mod 10 predicts tomorrow's sutta. Or (open sutta × close sutta) mod 10 → next day's open sutta. Try different arithmetic operations.

10. **"Prime vs Composite Sutta"**: Suttas 2, 3, 5, 7 are prime. Suttas 0, 1, 4, 6, 8, 9 are not (treating 0,1 as non-prime). Does the operator favor prime suttas on certain days? After a prime sutta, is the next sutta more likely prime or composite?

11. **"Digit Dominance"**: For each day, compute which digit (0-9) appeared most across all panels. Does the dominant digit from the day markets carry into night markets? Does yesterday's dominant digit get suppressed today?

### Cross-Market & Liquidity Chain Ideas

12. **"Mirror Market" Theory**: Kalyan and Main Bazar are the biggest markets (day and night anchors). Do their results mirror or anti-mirror? If Kalyan open panel = 368, does Main Bazar avoid 3, 6, 8 or gravitate toward them?

13. **"Cascade Velocity"**: When a DP appears in the first market (Sridevi), how many markets later does the next DP appear? Is there a consistent "DP velocity" — e.g., every 3rd market gets a DP? Or does it cluster?

14. **"Sutta Relay"**: Track the open sutta across the liquidity chain within a single day: Sridevi→Time Bazar→Madhur Day→Milan Day→Rajdhani Day→Kalyan. Does the sutta increment, decrement, or follow a pattern through the chain?

15. **"Opposite Market" Test**: Day market X and Night market X (e.g., Milan Day vs Milan Night, Rajdhani Day vs Rajdhani Night). Do they show correlation or anti-correlation? Same operator or different operator?

### Operator Behavior Profiling Ideas

16. **"Comfort Zone" Detection**: For each market, find panels that appear 3×+ more than expected in the 2-year data. These are the operator's "go-to" panels when they need a safe result. Use these as prediction anchors.

17. **"Avoidance Zone" Detection**: Panels that appear 3×+ less than expected. The operator structurally avoids these. Permanently suppress them in predictions.

18. **"Consecutive Repeat Suppression"**: How many draws minimum before the operator lets the same panel appear again? Is it always ≥3? ≥5? Is there a per-market minimum repeat gap?

19. **"Post-DP Behavior"**: After the operator drops a DP, what do the next 3 draws look like? Does the operator immediately go conservative (SP-SP-SP) or does DP cluster? Build a 3-draw lookahead profile after each DP.

20. **"Sutta Avoidance After Heavy Betting"**: When a sutta is "saturated" (hasn't appeared in 10+ draws, public is betting heavily on it), does the operator avoid it for even longer, or does it snap back at a predictable threshold?

### Jodi-Specific Ideas

21. **"Jodi Reversal"**: If today's jodi is 78, what's the probability of jodi 87 appearing within the next 7 days in the same market? Do reverse jodis have predictive power?

22. **"Jodi Sum" Pattern**: The sum of jodi digits (e.g., jodi 78 → 7+8=15 → 6). Does the jodi digit sum predict the next day's open sutta?

23. **"Jodi Sequence" Detection**: Track the sequence of jodis over a week. Do they follow arithmetic progressions? (e.g., 23→34→45→56). If a progression starts, does it continue?

### Advanced Statistical Ideas

24. **"Regime Detection"**: Use a Hidden Markov Model concept — classify each day into regimes: "Conservative" (0-1 DPs), "Moderate" (2-3 DPs), "Aggressive" (4+ DPs). What predicts regime transitions? Can we identify the current regime before markets open?

25. **"Information Leakage" Test**: Does the FIRST market's result (Sridevi) contain information about the LAST market's result (Main Bazar)? Compute mutual information between them. If nonzero, the operators may be coordinating.

26. **"Contrarian Signal"**: When our model is MOST confident about SP (dpScoreLead very negative), the actual result is DP 68% of the time (the sutta-3 blind spot). Generalize this: plot model confidence vs actual outcome. Find ALL blind spots, not just sutta-3.

27. **"Volatility Clustering"**: In financial markets, high volatility clusters together (GARCH effect). Does Matka show the same? If yesterday had unusual results (unexpected panels), is today more likely to also be unusual?

28. **"Benford's Law" Test**: Check if the first digit of panels follows Benford's Law distribution (which applies to many naturally-occurring datasets). Deviations from Benford's Law reveal operator manipulation patterns.

29. **"Streak Analysis"**: Track the longest consecutive SP streak per market. When a market hits its 90th percentile streak length, what is the DP probability on the very next draw? This is more precise than gap analysis.

30. **"Digit Pair Co-occurrence"**: Some digit pairs appear together in panels more than expected (e.g., 3 and 8 always seem to appear together). Build a 10×10 co-occurrence matrix. High co-occurrence pairs can narrow down panel candidates.
