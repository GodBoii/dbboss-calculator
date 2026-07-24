# Two-Digit Present Model V1

Actual results through **2026-07-23**. A hit requires **both** selected digits to occur in the same Open or Close panel.

## Walk-forward comparison

| Candidate | 30-day | 180-day | Decision |
|---|---:|---:|---|
| joint_30 | 4.43% (27/610) | 4.84% (176/3636) | Rejected |
| joint_90 | 7.21% (44/610) | 6.02% (219/3636) | Rejected |
| joint_180 | 7.21% (44/610) | 6.22% (226/3636) | Selected |
| joint_730 | 6.23% (38/610) | 5.72% (208/3636) | Rejected |
| avoid_appearance_marginal | 6.07% (37/610) | 5.80% (211/3636) | Rejected |
| panel_rank_recency | 5.90% (36/610) | 5.91% (215/3636) | Rejected |
| weekday_joint | 5.74% (35/610) | 5.01% (182/3636) | Rejected |
| sutta_conditioned | 6.07% (37/610) | 5.53% (201/3636) | Rejected |
| sp_dp_conditioned | 5.41% (33/610) | 5.89% (214/3636) | Rejected |
| jodi_transition | 5.25% (32/610) | 5.58% (203/3636) | Rejected |
| other_side_model_transfer | 5.08% (31/610) | 5.89% (214/3636) | Rejected |

## Scientific conclusion

- Selected model: `joint_180`.
- 70% target reached: **false**.
- Sutta, jodi, panel-recency, SP/DP, other-side, weekday, and avoid-model appearance signals were evaluated causally and rejected when they failed to improve.
- The app must label this output research-only until its Wilson lower bound reaches the configured target. No confidence value is inflated to match the requested target.

## Market-specific routing

Market routes were trained only on the 365 calendar days before the final 180-day test. A route required at least five extra hits and non-negative improvement in both training halves.

Promoted routes: none.

Observational route candidates (not promoted): Sridevi|open, Sridevi|close, Time Bazar|open, Madhur Day|open, Milan Day|open, Rajdhani Day|close, Kalyan|close, Kalyan Night|open, Madhur Night|open, Main Bazar|open.
