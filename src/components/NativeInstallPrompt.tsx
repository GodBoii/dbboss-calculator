"use client";

import { useEffect, useRef } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "dbboss-install-dismissed-at";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(display-mode: fullscreen)").matches ||
  ("standalone" in navigator && Boolean(navigator.standalone));

const isAndroidChrome = () => {
  const userAgent = navigator.userAgent;
  return (
    /Android/i.test(userAgent) &&
    /Chrome/i.test(userAgent) &&
    !/EdgA|OPR|SamsungBrowser/i.test(userAgent)
  );
};

const wasRecentlyDismissed = () => {
  const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) || 0);
  return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
};

export default function NativeInstallPrompt() {
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const promptedRef = useRef(false);

  useEffect(() => {
    if (!isAndroidChrome() || isStandalone() || wasRecentlyDismissed()) return;

    const cleanupInteractionListeners = () => {
      window.removeEventListener("pointerup", promptAfterGesture, true);
      window.removeEventListener("touchend", promptAfterGesture, true);
      window.removeEventListener("click", promptAfterGesture, true);
    };

    const promptAfterGesture = async () => {
      const promptEvent = promptRef.current;
      if (!promptEvent || promptedRef.current) return;

      promptedRef.current = true;
      cleanupInteractionListeners();

      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;

      if (outcome === "dismissed") {
        localStorage.setItem(DISMISSED_KEY, String(Date.now()));
      } else {
        localStorage.removeItem(DISMISSED_KEY);
      }

      promptRef.current = null;
    };

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as BeforeInstallPromptEvent;

      window.addEventListener("pointerup", promptAfterGesture, true);
      window.addEventListener("touchend", promptAfterGesture, true);
      window.addEventListener("click", promptAfterGesture, true);
    };

    const onAppInstalled = () => {
      promptRef.current = null;
      localStorage.removeItem(DISMISSED_KEY);
      cleanupInteractionListeners();
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      cleanupInteractionListeners();
    };
  }, []);

  return null;
}
