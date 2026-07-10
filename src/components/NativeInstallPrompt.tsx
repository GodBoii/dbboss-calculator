"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __lakshmiBossDeferredInstallPrompt?: BeforeInstallPromptEvent;
    __lakshmiBossPwaInstalled?: boolean;
  }
}

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

const isInstallPromptEvent = (
  event: BeforeInstallPromptEvent | Event | undefined,
): event is BeforeInstallPromptEvent =>
  Boolean(
    event &&
      "prompt" in event &&
      typeof event.prompt === "function" &&
      "userChoice" in event,
  );

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
        setShowIOSHelp(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    if (!isChromiumInstallCapable()) return;

    const showPrompt = (event: BeforeInstallPromptEvent) => {
      setPromptEvent(event);
      setShowInstallCta(true);
    };

    const syncSavedPrompt = () => {
      if (isInstallPromptEvent(window.__lakshmiBossDeferredInstallPrompt)) {
        showPrompt(window.__lakshmiBossDeferredInstallPrompt);
      }
    };

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const installEvent = event as BeforeInstallPromptEvent;
      window.__lakshmiBossDeferredInstallPrompt = installEvent;
      showPrompt(installEvent);
    };

    const onAppInstalled = () => {
      window.__lakshmiBossDeferredInstallPrompt = undefined;
      setPromptEvent(null);
      setShowInstallCta(false);
    };

    const initialSyncTimer = window.setTimeout(syncSavedPrompt, 0);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("lakshmi-boss:pwa-beforeinstallprompt", syncSavedPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    window.addEventListener("lakshmi-boss:pwa-appinstalled", onAppInstalled);

    return () => {
      window.clearTimeout(initialSyncTimer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("lakshmi-boss:pwa-beforeinstallprompt", syncSavedPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.removeEventListener("lakshmi-boss:pwa-appinstalled", onAppInstalled);
    };
  }, []);

  const dismiss = () => {
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
        window.__lakshmiBossDeferredInstallPrompt = undefined;
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
      <img src="/lakshmi-boss-192.png" alt="" className="pwa-install-icon" />
      <div className="pwa-install-copy">
        <span className="pwa-install-title">Install Lakshmi Boss</span>
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
