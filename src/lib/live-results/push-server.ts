import "server-only";

import webpush from "web-push";

import { getSupabaseAdmin } from "./supabase-server";
import type { ParsedSourceResult, ResultPhase } from "./types";

interface StoredSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  show_result_in_notification: boolean;
  failure_count: number;
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function sendTestPush(endpoint: string) {
  if (!configureWebPush()) throw new Error("Web Push is not configured");

  const supabase = getSupabaseAdmin();
  const stored = await supabase.from("push_subscriptions")
    .select("id,endpoint,p256dh,auth,show_result_in_notification,failure_count")
    .eq("endpoint", endpoint).eq("enabled", true).maybeSingle();
  if (stored.error) throw stored.error;
  if (!stored.data) throw new Error("Push subscription was not found");
  const subscription = stored.data as StoredSubscription;

  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify({
      title: "Lakshmi Boss notifications are ready",
      body: "Test successful. Market results will appear here when declared.",
      tag: "notification-test",
      url: "/#live-results",
    }),
    { TTL: 300, urgency: "normal" },
  );

  const updated = await supabase.from("push_subscriptions").update({
    last_success_at: new Date().toISOString(),
    failure_count: 0,
  }).eq("id", subscription.id);
  if (updated.error) throw updated.error;
}

export async function sendResultPush(
  marketId: string,
  marketName: string,
  phase: ResultPhase,
  parsed: ParsedSourceResult,
) {
  if (!configureWebPush()) return { sent: 0, failed: 0, skipped: true };

  const supabase = getSupabaseAdmin();
  const preferenceColumn = phase === "open" ? "notify_open" : "notify_close";
  const preferences = await supabase
    .from("notification_preferences")
    .select("subscription_id")
    .eq("market_id", marketId)
    .eq(preferenceColumn, true);
  if (preferences.error) throw preferences.error;

  const ids = (preferences.data ?? []).map((row) => row.subscription_id);
  if (!ids.length) return { sent: 0, failed: 0, skipped: false };

  const subscriptions = await supabase
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth,show_result_in_notification,failure_count")
    .in("id", ids)
    .eq("enabled", true);
  if (subscriptions.error) throw subscriptions.error;

  let sent = 0;
  let failed = 0;
  await Promise.allSettled(
    ((subscriptions.data ?? []) as StoredSubscription[]).map(async (subscription) => {
      const resultText = subscription.show_result_in_notification
        ? parsed.rawValue
        : "A new result is available.";
      const payload = JSON.stringify({
        title: `${marketName} ${phase === "open" ? "open" : "close"} result`,
        body: resultText,
        tag: `result-${marketId}-${phase}`,
        url: "/#live-results",
        marketId,
        phase,
      });

      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          { TTL: 3600, urgency: "high" },
        );
        sent += 1;
        await supabase.from("push_subscriptions").update({
          last_success_at: new Date().toISOString(),
          failure_count: 0,
        }).eq("id", subscription.id);
      } catch (error) {
        failed += 1;
        const statusCode = typeof error === "object" && error && "statusCode" in error
          ? Number(error.statusCode)
          : 0;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
        } else {
          const failureCount = subscription.failure_count + 1;
          await supabase.from("push_subscriptions").update({
            last_failure_at: new Date().toISOString(),
            failure_count: failureCount,
            enabled: failureCount < 10,
          }).eq("id", subscription.id);
        }
      }
    }),
  );

  return { sent, failed, skipped: false };
}
