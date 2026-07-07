"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const isInstalled =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    setIsStandalone(isInstalled);
    if (isInstalled) return;

    const isIosDevice = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    setIsIOS(isIosDevice);

    if (isIosDevice) {
      const timer = window.setTimeout(() => setShowPrompt(true), 3000);
      return () => window.clearTimeout(timer);
    }

    const fallbackTimer = window.setTimeout(() => setShowPrompt(true), 4000);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

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
  };

  if (!showPrompt || isStandalone) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-50 animate-fade-in-up">
      <div className="glass-panel !mb-0 border !border-white/20 !p-5 relative overflow-hidden !bg-black/95 !backdrop-blur-2xl shadow-[0_15px_40px_rgba(0,0,0,0.8)]">
        <div className="absolute top-0 left-0 w-[200%] h-full bg-gradient-to-tr from-transparent via-white/10 to-transparent transform -skew-x-12 translate-x-[-100%] animate-[shine_3s_infinite]" />

        <button
          onClick={() => setShowPrompt(false)}
          className="absolute top-2 right-3 text-white/50 hover:text-white transition-colors text-lg"
          aria-label="Close"
        >
          x
        </button>

        <div className="flex items-center gap-3 mb-3">
          <img src="/dbboss.png" alt="" className="w-10 h-10 rounded-xl object-cover border border-white/15" />
          <h3 className="text-lg font-bold text-white">Install DBboss</h3>
        </div>

        <p className="text-sm text-white/80 mb-4">
          {isIOS
            ? "To install on iOS, tap Share in Safari and select Add to Home Screen."
            : deferredPrompt
              ? "Add DBboss to your home screen for the full-screen app."
              : "If Chrome does not show the install button yet, open the browser menu and choose Add to Home screen."}
        </p>

        {!isIOS && (
          <button
            onClick={handleInstallClick}
            className="w-full glass-button !bg-white/10 hover:!bg-white/20 !border-white/30 !text-white font-bold shadow-[0_0_15px_rgba(255,255,255,0.1)]"
          >
            {deferredPrompt ? "Install App Now" : "Got it"}
          </button>
        )}
      </div>
    </div>
  );
}
