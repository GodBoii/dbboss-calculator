"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type PWAWindow = Window & {
  __pwa_install_event?: BeforeInstallPromptEvent | null;
};

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Nothing to do if already installed as a PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const w = window as PWAWindow;

    // setTimeout makes the setState a callback (not synchronous inside effect)
    // and picks up the event captured by the early inline script in layout.tsx
    const t = window.setTimeout(() => {
      if (w.__pwa_install_event) setPrompt(w.__pwa_install_event);
    }, 0);

    // Also handle events that fire after this component mounts
    const onInstallable = () => {
      if (w.__pwa_install_event) setPrompt(w.__pwa_install_event);
    };
    window.addEventListener("pwa-install-ready", onInstallable);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pwa-install-ready", onInstallable);
    };
  }, []);

  if (!prompt) return null;

  const handleInstall = async () => {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setPrompt(null);
      (window as PWAWindow).__pwa_install_event = null;
    }
  };

  return (
    <div className="pwa-install-bar">
      <button className="pwa-install-btn" onClick={handleInstall}>
        <span>📲</span>
        <span>Install DBboss App</span>
      </button>
    </div>
  );
}
