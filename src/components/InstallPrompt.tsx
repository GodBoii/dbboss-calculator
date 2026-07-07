"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type PWAWindow = Window & {
  __pwa_install_event?: BeforeInstallPromptEvent | null;
};

// Lazy initializers — safe during SSR (window absent → defaults)
function detectStandalone(): boolean | null {
  if (typeof window === "undefined") return null;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

function detectIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
}

export default function InstallPrompt() {
  // Initialized via lazy functions — no synchronous setState calls needed inside effects
  const [isStandalone] = useState<boolean | null>(detectStandalone);
  const [isIOS] = useState<boolean>(detectIOS);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Already running as an installed PWA — nothing to show
    if (isStandalone) return;

    if (isIOS) {
      const timer = window.setTimeout(() => setShowPrompt(true), 3000);
      return () => window.clearTimeout(timer);
    }

    const w = window as PWAWindow;

    // Check the global capture slot asynchronously (setState must be in a callback per Next.js rules)
    const checkTimer = window.setTimeout(() => {
      if (w.__pwa_install_event) {
        setDeferredPrompt(w.__pwa_install_event);
        setShowPrompt(true);
      }
    }, 0);

    // After 5s with no native prompt, show a manual-install hint as fallback
    const fallbackTimer = window.setTimeout(() => setShowPrompt(true), 5000);

    // In case the event fires after this component mounts, listen for the custom relay event
    const handleInstallReady = () => {
      if (w.__pwa_install_event) {
        setDeferredPrompt(w.__pwa_install_event);
        setShowPrompt(true);
        window.clearTimeout(fallbackTimer);
      }
    };

    window.addEventListener("pwa-install-ready", handleInstallReady);
    return () => {
      window.clearTimeout(checkTimer);
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("pwa-install-ready", handleInstallReady);
    };
  }, [isIOS, isStandalone]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      setShowPrompt(false);
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
    (window as PWAWindow).__pwa_install_event = null;
  };

  // null = pre-hydration; true = already installed; false + !showPrompt = still waiting
  if (isStandalone === null || isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-50 animate-fade-in-up">
      <div className="glass-panel mb-0! border border-white/20! p-5! relative overflow-hidden bg-black/95! backdrop-blur-2xl! shadow-[0_15px_40px_rgba(0,0,0,0.8)]">
        <div className="absolute top-0 left-0 w-[200%] h-full bg-linear-to-tr from-transparent via-white/10 to-transparent -skew-x-12 -translate-x-full animate-[shine_3s_infinite]" />

        <button
          onClick={() => setShowPrompt(false)}
          className="absolute top-2 right-3 text-white/50 hover:text-white transition-colors text-lg"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/dbboss.png"
            alt=""
            className="w-10 h-10 rounded-xl object-cover border border-white/15"
          />
          <h3 className="text-lg font-bold text-white">Install DBboss</h3>
        </div>

        <p className="text-sm text-white/80 mb-4">
          {isIOS
            ? "To install on iOS, tap Share in Safari and select Add to Home Screen."
            : deferredPrompt
              ? "Add DBboss to your home screen for the full-screen app experience."
              : "Open the browser menu (\u22ee) and choose \u201cAdd to Home screen\u201d to install."}
        </p>

        {!isIOS && (
          <button
            onClick={handleInstallClick}
            className="w-full glass-button bg-white/10! hover:bg-white/20! border-white/30! text-white! font-bold shadow-[0_0_15px_rgba(255,255,255,0.1)]"
          >
            {deferredPrompt ? "Install App Now" : "Got it"}
          </button>
        )}
      </div>
    </div>
  );
}
