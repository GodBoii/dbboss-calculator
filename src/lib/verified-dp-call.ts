/**
 * A DP call needs a frozen rule that cleared the 90% precision requirement
 * on unseen outcomes. The current audit found no such rule, so this boundary
 * deliberately abstains. The existing kind forecast is not calibrated for
 * that requirement and must not be used to emit a DP call.
 *
 * See research/dp_only_v1/REPORT.md before adding a rule here.
 */
export function getVerifiedDpCalls(): Readonly<{ open: "DP" | null; close: "DP" | null }> {
  return { open: null, close: null }
}
