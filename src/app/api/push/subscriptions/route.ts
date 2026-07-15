import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/live-results/supabase-server";
import { sendTestPush } from "@/lib/live-results/push-server";

interface SubscriptionBody {
  subscription?: {
    endpoint?: string;
    expirationTime?: number | null;
    keys?: { p256dh?: string; auth?: string };
  };
  marketIds?: string[];
  showResult?: boolean;
}

function validSubscription(body: SubscriptionBody) {
  const { endpoint, keys } = body.subscription ?? {};
  return Boolean(
    endpoint &&
    endpoint.length <= 2048 &&
    endpoint.startsWith("https://") &&
    keys?.p256dh && keys.p256dh.length <= 256 &&
    keys.auth && keys.auth.length <= 128,
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SubscriptionBody;
    if (!validSubscription(body)) {
      return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const activeMarkets = await supabase.from("markets").select("id").eq("is_active", true);
    if (activeMarkets.error) throw activeMarkets.error;
    const allowedIds = new Set((activeMarkets.data ?? []).map((market) => market.id));
    const requestedIds = body.marketIds?.length ? body.marketIds : [...allowedIds];
    if (requestedIds.some((id) => !allowedIds.has(id))) {
      return NextResponse.json({ error: "Unknown market selection." }, { status: 400 });
    }

    const subscription = body.subscription!;
    const saved = await supabase.from("push_subscriptions").upsert({
      endpoint: subscription.endpoint!,
      p256dh: subscription.keys!.p256dh!,
      auth: subscription.keys!.auth!,
      expiration_time: subscription.expirationTime ?? null,
      enabled: true,
      show_result_in_notification: body.showResult !== false,
      user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    }, { onConflict: "endpoint" }).select("id").single();
    if (saved.error) throw saved.error;

    const cleared = await supabase.from("notification_preferences")
      .delete().eq("subscription_id", saved.data.id);
    if (cleared.error) throw cleared.error;

    if (requestedIds.length) {
      const preferences = await supabase.from("notification_preferences").insert(
        requestedIds.map((marketId) => ({
          subscription_id: saved.data.id,
          market_id: marketId,
          notify_open: true,
          notify_close: true,
        })),
      );
      if (preferences.error) throw preferences.error;
    }

    try {
      await sendTestPush(subscription.endpoint!);
    } catch (error) {
      await supabase.from("push_subscriptions").delete().eq("id", saved.data.id);
      throw error;
    }
    return NextResponse.json({ ok: true, testNotificationSent: true });
  } catch (error) {
    console.error("[push-subscription] Failed to save subscription", error);
    return NextResponse.json({ error: "Could not save notification settings." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json() as { endpoint?: string };
    if (!body.endpoint || !body.endpoint.startsWith("https://")) {
      return NextResponse.json({ error: "Invalid push endpoint." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const removed = await supabase.from("push_subscriptions").delete().eq("endpoint", body.endpoint);
    if (removed.error) throw removed.error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[push-subscription] Failed to remove subscription", error);
    return NextResponse.json({ error: "Could not disable notifications." }, { status: 500 });
  }
}
