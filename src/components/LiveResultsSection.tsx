"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { LiveResultsResponse, MarketResult } from "@/lib/live-results/types";

type NoticeState = "checking" | "unsupported" | "unconfigured" | "off" | "on" | "blocked" | "busy";

function vapidKey(value: string) {
  const padded = `${value}${"=".repeat((4 - value.length % 4) % 4)}`;
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function resultForMarket(results: MarketResult[], marketId: string) {
  return results.find((result) => result.market_id === marketId);
}

function displayTime(value: string) {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" })
    .format(new Date(2020, 0, 1, hour, minute));
}

export default function LiveResultsSection() {
  const [data, setData] = useState<LiveResultsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<NoticeState>("checking");
  const [noticeError, setNoticeError] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  const refresh = useCallback(async (scrapeFirst = false) => {
    if (scrapeFirst) setRefreshing(true);
    try {
      if (scrapeFirst) {
        const refreshResponse = await fetch("/api/live-results/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!refreshResponse.ok) throw new Error("Result scrape failed");
      }
      const response = await fetch("/api/live-results", { cache: "no-store" });
      if (!response.ok) throw new Error("Results service is unavailable");
      setData(await response.json() as LiveResultsResponse);
      setError("");
    } catch {
      setError("Live results could not be refreshed. Your calculator and saved analysis data are unaffected.");
    } finally {
      setLoading(false);
      if (scrapeFirst) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60_000);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(timer);
    };
  }, [refresh]);

  useEffect(() => {
    async function checkNotifications() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setNotice("unsupported");
        return;
      }
      if (!publicVapidKey) {
        setNotice("unconfigured");
        return;
      }
      if (Notification.permission === "denied") {
        setNotice("blocked");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      setNotice((await registration.pushManager.getSubscription()) ? "on" : "off");
    }
    void checkNotifications().catch(() => setNotice("off"));
  }, [publicVapidKey]);

  const toggleNotifications = async () => {
    if (!data || notice === "busy") return;
    setNoticeError("");
    setNoticeMessage("");
    setNotice("busy");
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        const response = await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        if (!response.ok) throw new Error("Server did not remove the subscription");
        await existing.unsubscribe();
        setNotice("off");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNotice(permission === "denied" ? "blocked" : "off");
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey(publicVapidKey),
      });
      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          marketIds: data.markets.map((market) => market.id),
          showResult: true,
        }),
      });
      if (!response.ok) {
        await subscription.unsubscribe();
        throw new Error("Server did not save the subscription");
      }
      setNotice("on");
      setNoticeMessage("Test notification sent to this device.");
    } catch (caught) {
      console.error("[notifications] Could not update subscription", caught);
      setNoticeError("Notification settings could not be updated. Please try again.");
      setNotice("off");
    }
  };

  const testNotifications = async () => {
    setNoticeError("");
    setNoticeMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) throw new Error("No active subscription");
      const response = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      if (!response.ok) throw new Error("Test delivery failed");
      setNoticeMessage("Test notification sent to this device.");
    } catch (caught) {
      console.error("[notifications] Test notification failed", caught);
      setNoticeError("Test notification could not be delivered.");
    }
  };

  const resultCount = data?.results.length ?? 0;
  const formattedDate = useMemo(() => {
    if (!data?.date) return "Today";
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: data.timezone })
      .format(new Date(`${data.date}T12:00:00+05:30`));
  }, [data]);

  return (
    <section className="live-page" id="live-results" aria-labelledby="live-results-title">
      <div className="live-heading">
        <div>
          <span className="live-eyebrow">{formattedDate} · IST</span>
          <h1 id="live-results-title">Market Results</h1>
          <p>Verified open and close results for your 12 markets.</p>
        </div>
        <button className="live-refresh" onClick={() => void refresh(true)} disabled={loading || refreshing} aria-label="Scrape and refresh results">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 6V2m0 0h-4m4 0-3 3a6 6 0 1 0 1.2 8.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      <div className="card live-notice-card">
        <div className="live-notice-icon" aria-hidden="true">{notice === "on" ? "✓" : "↗"}</div>
        <div className="live-notice-copy">
          <strong>{notice === "on" ? "Result alerts are on" : "Get result alerts"}</strong>
          <span>{notice === "on" ? "This device will receive all 12 market results." : "See the result directly in your Android PWA notification."}</span>
          {notice === "blocked" && <small>Notifications are blocked in browser settings.</small>}
          {notice === "unsupported" && <small>Push is not supported in this browser.</small>}
          {notice === "unconfigured" && <small>Push will be available after deployment setup.</small>}
          {noticeMessage && <small className="live-notice-success">{noticeMessage}</small>}
          {noticeError && <small>{noticeError}</small>}
        </div>
        <div className="live-notice-actions">
          {notice === "on" && <button className="live-notice-test" onClick={testNotifications}>Test</button>}
          {(notice === "off" || notice === "on" || notice === "busy") && (
            <button className={`live-notice-button ${notice === "on" ? "live-notice-button--off" : ""}`} onClick={toggleNotifications} disabled={notice === "busy"}>
              {notice === "busy" ? "…" : notice === "on" ? "Turn off" : "Enable"}
            </button>
          )}
        </div>
      </div>

      <div className="live-summary">
        <span><strong>{resultCount}</strong> of {data?.markets.length ?? 12} updated</span>
        <span className="live-dot" />
        <span>Auto-refreshes every minute</span>
      </div>

      {error && <div className="live-error" role="status">{error}</div>}
      {loading && !data ? (
        <div className="loading-placeholder"><div className="loading-placeholder-spinner" /><span>Loading today’s results…</span></div>
      ) : (
        <div className="live-grid">
          {data?.markets.map((market) => {
            const result = resultForMarket(data.results, market.id);
            return (
              <article className={`live-market ${result ? "live-market--ready" : ""}`} key={market.id}>
                <div className="live-market-top">
                  <div>
                    <h2>{market.display_name}</h2>
                    <span>{displayTime(market.open_time)} – {displayTime(market.close_time)}</span>
                  </div>
                  <span className={`live-session live-session--${market.session}`}>{market.session}</span>
                </div>
                {result ? (
                  <div className="live-result-value" aria-label={`${market.display_name} result ${result.raw_source_value}`}>
                    <span>{result.open_panel}</span>
                    <b>{result.status === "open" ? result.open_digit : result.jodi}</b>
                    <span>{result.close_panel ?? "***"}</span>
                  </div>
                ) : (
                  <div className="live-pending"><span>***</span><b>**</b><span>***</span></div>
                )}
                <div className="live-market-bottom">
                  <span className={result ? "live-status-ready" : ""}>{result ? (result.status === "open" ? "Open declared" : "Final declared") : "Waiting for result"}</span>
                  <a href={market.history_url} target="_blank" rel="noreferrer">History</a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
