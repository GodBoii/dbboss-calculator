import { NextRequest, NextResponse } from "next/server";

import { sendResultPush } from "@/lib/live-results/push-server";
import { parseHomepageResults, sourceHash } from "@/lib/live-results/source-parser";
import { getSupabaseAdmin } from "@/lib/live-results/supabase-server";
import { activePhase, resultDateForMarket } from "@/lib/live-results/time";
import type { Market, MarketResult, ParsedSourceResult, ResultPhase } from "@/lib/live-results/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SOURCE_URL = "https://dpbossss.boston/";

function authorized(request: NextRequest) {
  const secret = process.env.RESULT_MONITOR_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

async function confirmCandidate(
  market: Market,
  phase: ResultPhase,
  parsed: ParsedSourceResult,
  resultDate: string,
) {
  const supabase = getSupabaseAdmin();
  const hash = sourceHash(market.id, resultDate, parsed.rawValue);
  const now = new Date().toISOString();
  const candidateQuery = await supabase.from("monitor_candidates").select("source_hash,consecutive_observations,first_seen_at")
    .eq("market_id", market.id).eq("result_date", resultDate).eq("phase", phase).maybeSingle();
  if (candidateQuery.error) throw candidateQuery.error;

  const previousCandidate = candidateQuery.data;
  const unchanged = previousCandidate !== null && previousCandidate.source_hash === hash;
  const count = unchanged ? Math.min(previousCandidate.consecutive_observations + 1, 10) : 1;
  const firstSeen = unchanged ? previousCandidate.first_seen_at : now;
  const candidate = await supabase.from("monitor_candidates").upsert({
    market_id: market.id,
    result_date: resultDate,
    phase,
    raw_source_value: parsed.rawValue,
    source_hash: hash,
    consecutive_observations: count,
    first_seen_at: firstSeen,
    last_seen_at: now,
  }, { onConflict: "market_id,result_date,phase" });
  if (candidate.error) throw candidate.error;
  if (count < 2) return false;

  let result: MarketResult;
  if (phase === "open") {
    const saved = await supabase.from("market_results").upsert({
      market_id: market.id,
      result_date: resultDate,
      status: "open",
      open_panel: parsed.openPanel,
      open_digit: parsed.openDigit,
      jodi: null,
      close_panel: null,
      close_digit: null,
      raw_source_value: parsed.rawValue,
      source_url: SOURCE_URL,
      source_hash: hash,
      first_detected_at: firstSeen,
      confirmed_at: now,
    }, { onConflict: "market_id,result_date", ignoreDuplicates: true }).select("*").maybeSingle();
    if (saved.error) throw saved.error;
    if (!saved.data) return false;
    result = saved.data as MarketResult;
  } else {
    const existing = await supabase.from("market_results").select("*")
      .eq("market_id", market.id).eq("result_date", resultDate).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data && existing.data.status !== "open") return false;
    if (
      existing.data &&
      (existing.data.open_panel !== parsed.openPanel || existing.data.open_digit !== parsed.openDigit)
    ) return false;

    const write = existing.data
      ? supabase.from("market_results").update({
          status: "closed",
          jodi: parsed.jodi,
          close_panel: parsed.closePanel,
          close_digit: parsed.closeDigit,
          raw_source_value: parsed.rawValue,
          source_hash: hash,
          confirmed_at: now,
        }).eq("id", existing.data.id).eq("status", "open")
      : supabase.from("market_results").insert({
          market_id: market.id,
          result_date: resultDate,
          status: "closed",
          open_panel: parsed.openPanel,
          open_digit: parsed.openDigit,
          jodi: parsed.jodi,
          close_panel: parsed.closePanel,
          close_digit: parsed.closeDigit,
          raw_source_value: parsed.rawValue,
          source_url: SOURCE_URL,
          source_hash: hash,
          first_detected_at: firstSeen,
          confirmed_at: now,
        });
    const saved = await write.select("*").maybeSingle();
    if (saved.error) throw saved.error;
    if (!saved.data) return false;
    result = saved.data as MarketResult;
  }

  const event = await supabase.from("result_events").upsert({
    result_id: result.id,
    phase,
    source_hash: hash,
    payload: parsed,
    detected_at: firstSeen,
    confirmed_at: now,
  }, { onConflict: "result_id,phase,source_hash", ignoreDuplicates: true }).select("id").maybeSingle();
  if (event.error) throw event.error;
  if (!event.data) return false;

  await supabase.from("result_events").update({ push_started_at: now }).eq("id", event.data.id);
  await sendResultPush(market.id, market.display_name, phase, parsed);
  await supabase.from("result_events").update({ push_completed_at: new Date().toISOString() }).eq("id", event.data.id);
  return true;
}

async function runMonitor(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  let runId: number | null = null;
  try {
    const marketsQuery = await supabase.from("markets").select("*").eq("is_active", true).order("sort_order");
    if (marketsQuery.error) throw marketsQuery.error;
    const active = ((marketsQuery.data ?? []) as Market[])
      .map((market) => ({ market, phase: activePhase(market) }))
      .filter((item): item is { market: Market; phase: ResultPhase } => item.phase !== null);

    const run = await supabase.from("monitor_runs").insert({
      status: "running",
      active_markets: active.map(({ market, phase }) => `${market.id}:${phase}`),
    }).select("id").single();
    if (run.error) throw run.error;
    runId = run.data.id;

    if (!active.length) {
      await supabase.from("monitor_runs").update({ status: "success", completed_at: new Date().toISOString() }).eq("id", runId);
      return NextResponse.json({ ok: true, activeMarkets: 0, confirmedEvents: 0 });
    }

    const response = await fetch(SOURCE_URL, {
      cache: "no-store",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "LakshmiBossResultMonitor/1.0 (+result verification)",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Result source returned HTTP ${response.status}`);
    const html = await response.text();
    if (html.length > 3_000_000) throw new Error("Result source response exceeded the safe size limit");
    const parsed = parseHomepageResults(html);
    const confirmations = await Promise.all(
      active.map(async ({ market, phase }) => {
        const result = parsed.get(market.homepage_name);
        if (!result || result.phase !== phase) return false;
        const resultDate = resultDateForMarket(market, phase);
        return confirmCandidate(market, phase, result, resultDate);
      }),
    );
    const confirmedEvents = confirmations.filter(Boolean).length;

    await supabase.from("monitor_runs").update({
      status: "success",
      completed_at: new Date().toISOString(),
      source_http_status: response.status,
      source_cache_status: response.headers.get("cf-cache-status"),
      source_age_seconds: Number(response.headers.get("age")) || null,
      parsed_market_count: parsed.size,
      confirmed_event_count: confirmedEvents,
    }).eq("id", runId);
    return NextResponse.json({ ok: true, activeMarkets: active.length, parsedMarkets: parsed.size, confirmedEvents });
  } catch (error) {
    console.error("[result-monitor] Monitor run failed", error);
    if (runId !== null) {
      await supabase.from("monitor_runs").update({
        status: "internal_error",
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message.slice(0, 1000) : "Unknown monitor error",
      }).eq("id", runId);
    }
    return NextResponse.json({ error: "Monitor run failed." }, { status: 500 });
  }
}

export const GET = runMonitor;
export const POST = runMonitor;
