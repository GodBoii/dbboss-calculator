"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "dbboss-install-dismissed-at-v2";
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(display-mode: fullscreen)").matches ||
  ("standalone" in navigator && Boolean(navigator.standalone));

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isChromiumInstallCapable = () => {
  const userAgent = navigator.userAgent;
  const vendor = navigator.vendor;

  return (
    /Chrome|CriOS|EdgA|EdgiOS|Edg|OPR|SamsungBrowser/i.test(userAgent) ||
    /Google Inc\./i.test(vendor)
  );
};

const wasRecentlyDismissed = () => {
  const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) || 0);
  return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
};

export default function NativeInstallPrompt() {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallCta, setShowInstallCta] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    if (isIOS()) {
      const timer = window.setTimeout(() => {
        setShowIOSHelp(!wasRecentlyDismissed());
      }, 0);
      return () => window.clearTimeout(timer);
    }

    if (!isChromiumInstallCapable()) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);

      if (!wasRecentlyDismissed()) {
        setShowInstallCta(true);
      }
    };

    const onAppInstalled = () => {
      setPromptEvent(null);
      setShowInstallCta(false);
      localStorage.removeItem(DISMISSED_KEY);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setShowInstallCta(false);
    setShowIOSHelp(false);
  };

  const install = async () => {
    if (!promptEvent || isInstalling) return;

    setIsInstalling(true);
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;

      if (outcome === "accepted") {
        localStorage.removeItem(DISMISSED_KEY);
        setShowInstallCta(false);
        setPromptEvent(null);
      } else {
        dismiss();
      }
    } finally {
      setIsInstalling(false);
    }
  };

  if (!showInstallCta && !showIOSHelp) return null;

  return (
    <div className="pwa-install-banner" role="status" aria-live="polite">
      <img src="/dbboss-192.png" alt="" className="pwa-install-icon" />
      <div className="pwa-install-copy">
        <span className="pwa-install-title">Install DBboss</span>
        <span className="pwa-install-subtitle">
          {showIOSHelp
            ? "Use Share, then Add to Home Screen."
            : "Open it like a mobile app."}
        </span>
      </div>
      {showInstallCta && (
        <button
          className="pwa-install-action"
          onClick={install}
          disabled={isInstalling}
        >
          {isInstalling ? "Opening..." : "Install"}
        </button>
      )}
      <button className="pwa-install-dismiss" onClick={dismiss} aria-label="Dismiss">
        x
      </button>
    </div>
  );
}
