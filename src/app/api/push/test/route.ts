import { NextRequest, NextResponse } from "next/server";

import { sendTestPush } from "@/lib/live-results/push-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { endpoint?: string };
    if (!body.endpoint || body.endpoint.length > 2048 || !body.endpoint.startsWith("https://")) {
      return NextResponse.json({ error: "Invalid push endpoint." }, { status: 400 });
    }
    await sendTestPush(body.endpoint);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[push-test] Test notification failed", error);
    return NextResponse.json({ error: "Test notification could not be delivered." }, { status: 500 });
  }
}
