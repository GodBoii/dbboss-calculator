import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/live-results/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.RESULT_MONITOR_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Result refresh is not configured." }, { status: 503 });
    }

    const supabase = getSupabaseAdmin();
    const latest = await supabase.from("monitor_runs").select("started_at")
      .order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (latest.error) throw latest.error;

    const lastStarted = latest.data ? new Date(latest.data.started_at).getTime() : 0;
    if (Date.now() - lastStarted < 45_000) {
      return NextResponse.json({ ok: true, throttled: true });
    }

    const monitorResponse = await fetch(new URL("/api/monitor-results", request.nextUrl.origin), {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source: "user-refresh" }),
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await monitorResponse.json();
    return NextResponse.json(payload, { status: monitorResponse.ok ? 200 : 502 });
  } catch (error) {
    console.error("[live-results-refresh] Refresh failed", error);
    return NextResponse.json({ error: "Could not refresh market results." }, { status: 500 });
  }
}
