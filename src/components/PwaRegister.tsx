"use client";

import { useEffect } from "react";

/**
 * Explicitly registers the app-owned service worker.
 *
 * Doing it here gives us a guaranteed, auditable registration call that
 * happens on every page load in the Next.js App Router.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((err) => {
          console.warn("[PWA] Service worker registration failed:", err);
        });
    };

    // If the page is already loaded, register immediately.
    // Otherwise wait for the load event so we don't block first paint.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
