import "server-only";
import { getSupabaseAdmin } from "./supabase-server";
import { sendResultPush } from "./push-server";
import { normalizeSourceValue } from "./source-parser";
import type { Market, ParsedSourceResult, ResultPhase } from "./types";

/** A short lease prevents overlapping monitors from delivering the same event. */
export async function deliverResultEvent(id: number, market: Market, phase: ResultPhase, parsed: ParsedSourceResult) {
  const supabase = getSupabaseAdmin();
  const leaseExpiry = new Date(Date.now()-2*60*1000).toISOString();
  const claimed = await supabase.from("result_events").update({push_started_at:new Date().toISOString()})
    .eq("id",id).is("push_completed_at",null)
    .or(`push_started_at.is.null,push_started_at.lt.${leaseExpiry}`).select("id,payload").maybeSingle();
  if (claimed.error) throw claimed.error;
  if (!claimed.data) return false;
  const claimedEvent = claimed.data;
  const payload: unknown = claimedEvent.payload;
  const priorIds = payload && typeof payload === "object" && "deliveredSubscriptionIds" in payload ? payload.deliveredSubscriptionIds : [];
  const delivered = new Set<string>(Array.isArray(priorIds) ? priorIds.filter((id): id is string => typeof id === "string") : []);
  let writes = Promise.resolve();
  const outcome = await sendResultPush(market.id,market.display_name,phase,parsed,{
    alreadySent:delivered,
    onDelivered(id) {
      // Serialize acknowledgments so parallel recipients cannot overwrite each other.
      writes = writes.then(async () => {
        delivered.add(id);
        const saved = await supabase.from("result_events").update({payload:{...parsed,deliveredSubscriptionIds:[...delivered]}}).eq("id",claimedEvent.id);
        if (saved.error) throw saved.error;
      });
      return writes;
    },
  });
  await writes;
  if (outcome.skipped || outcome.failed > 0) return false;
  const completed = await supabase.from("result_events").update({push_completed_at:new Date().toISOString()}).eq("id",id);
  if (completed.error) throw completed.error;
  return true;
}

/** Retries run even when no market is currently active. No schema migration needed. */
export async function retryPendingResultEvents(markets: Market[]) {
  const supabase = getSupabaseAdmin();
  const pending = await supabase.from("result_events").select("id,result_id,phase,payload")
    .is("push_completed_at",null).gte("confirmed_at",new Date(Date.now()-24*60*60*1000).toISOString())
    .order("confirmed_at").limit(6);
  if (pending.error) throw pending.error;
  const attempts = await Promise.allSettled((pending.data ?? []).map(async event => {
    if (event.phase !== "open" && event.phase !== "close") return;
    const payload: unknown = event.payload;
    if (!payload || typeof payload !== "object" || !("rawValue" in payload) || typeof payload.rawValue !== "string") return;
    const parsed = normalizeSourceValue(payload.rawValue);
    if (!parsed || parsed.phase !== event.phase) return;
    const result = await supabase.from("market_results").select("market_id").eq("id",event.result_id).maybeSingle();
    if (result.error) throw result.error;
    const market = markets.find(market => market.id === result.data?.market_id);
    if (market) await deliverResultEvent(event.id,market,event.phase,parsed);
  }));
  for (const attempt of attempts) if (attempt.status === "rejected") console.error("[result-push] Pending delivery could not finish",attempt.reason);
}
