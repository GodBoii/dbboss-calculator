import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/live-results/supabase-server";
import { indiaDate, RESULT_TIMEZONE } from "@/lib/live-results/time";
import type { LiveResultsResponse, Market, MarketResult } from "@/lib/live-results/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const date = indiaDate();
    const supabase = getSupabaseAdmin();
    const [marketsQuery, resultsQuery] = await Promise.all([
      supabase.from("markets").select("id,display_name,homepage_name,session,open_time,close_time,timezone,history_url,source_url,sort_order").eq("is_active", true).order("sort_order"),
      supabase.from("market_results").select("id,market_id,result_date,status,open_panel,open_digit,jodi,close_panel,close_digit,raw_source_value,confirmed_at,corrected_at").eq("result_date", date),
    ]);

    if (marketsQuery.error) throw marketsQuery.error;
    if (resultsQuery.error) throw resultsQuery.error;

    const payload: LiveResultsResponse = {
      date,
      timezone: RESULT_TIMEZONE,
      markets: (marketsQuery.data ?? []) as Market[],
      results: (resultsQuery.data ?? []) as MarketResult[],
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("[live-results] Failed to load results", error);
    return NextResponse.json(
      { error: "Live results are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
