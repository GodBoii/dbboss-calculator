# Top-3 Independent-Source Replication

The formulas were fixed before this replay. No independent-source row selects a formula or threshold.

## Source consistency

Overlapping rows: 3381. Jodi agreement: 100.0%. Full-panel agreement: 100.0%.

## Fixed-formula replay

| Block | Target | Hits | N | Accuracy | Nominal | 95% Wilson interval | p (one-sided vs nominal) | 90% gate |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | --- |
| all | open | 1141 | 3613 | 31.6% | 30.0% | 30.1%–33.1% | 0.0203 | fail |
| all | close | 1020 | 3613 | 28.2% | 30.0% | 26.8%–29.7% | 0.991 | fail |
| all | adjustedClose | 1094 | 3613 | 30.3% | 30.0% | 28.8%–31.8% | 0.363 | fail |
| all | exactJodi | 129 | 3613 | 3.6% | 3.0% | 3.0%–4.2% | 0.0273 | fail |
| all | jodiGrid | 334 | 3613 | 9.2% | 9.0% | 8.3%–10.2% | 0.312 | fail |
| last90CalendarDays | open | 176 | 557 | 31.6% | 30.0% | 27.9%–35.6% | 0.218 | fail |
| last90CalendarDays | close | 155 | 557 | 27.8% | 30.0% | 24.3%–31.7% | 0.878 | fail |
| last90CalendarDays | adjustedClose | 165 | 557 | 29.6% | 30.0% | 26.0%–33.5% | 0.593 | fail |
| last90CalendarDays | exactJodi | 20 | 557 | 3.6% | 3.0% | 2.3%–5.5% | 0.238 | fail |
| last90CalendarDays | jodiGrid | 53 | 557 | 9.5% | 9.0% | 7.3%–12.2% | 0.356 | fail |
| perMarketLast20Percent | open | 220 | 725 | 30.3% | 30.0% | 27.1%–33.8% | 0.434 | fail |
| perMarketLast20Percent | close | 201 | 725 | 27.7% | 30.0% | 24.6%–31.1% | 0.917 | fail |
| perMarketLast20Percent | adjustedClose | 226 | 725 | 31.2% | 30.0% | 27.9%–34.6% | 0.257 | fail |
| perMarketLast20Percent | exactJodi | 24 | 725 | 3.3% | 3.0% | 2.2%–4.9% | 0.341 | fail |
| perMarketLast20Percent | jodiGrid | 70 | 725 | 9.7% | 9.0% | 7.7%–12.0% | 0.286 | fail |

Exact Jodi means exactly three pairs. The grid is separately reported as nine pairs.
