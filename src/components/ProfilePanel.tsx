"use client";

import { useState, useEffect, useCallback } from "react";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

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

export default function ProfilePanel({ isOpen, onClose }: ProfilePanelProps) {
  const {
    updateAvailable,
    isChecking,
    isUpdating,
    checkForUpdate,
    installUpdate,
  } = usePWAUpdate();
  const [toast, setToast] = useState<string | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  // Initialized via lazy functions — no synchronous setState needed inside effects
  const [isStandalone] = useState<boolean | null>(detectStandalone);
  const [isIOS] = useState<boolean>(detectIOS);

  // showToast declared before any useEffect that calls it to satisfy hoisting rules
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (updateAvailable) {
      // setTimeout defers setState so it runs in a callback, not synchronously in the effect
      const t = window.setTimeout(
        () => showToast("\uD83C\uDF89 New update available!"),
        0,
      );
      return () => window.clearTimeout(t);
    }
  }, [updateAvailable, showToast]);

  useEffect(() => {
    const w = window as PWAWindow;

    // Check global capture slot asynchronously (setState must be in a callback per Next.js rules)
    const checkTimer = window.setTimeout(() => {
      if (w.__pwa_install_event) {
        setDeferredPrompt(w.__pwa_install_event);
        setCanInstall(true);
      }
    }, 0);

    // In case the event fires after this component mounts
    const handleInstallReady = () => {
      if (w.__pwa_install_event) {
        setDeferredPrompt(w.__pwa_install_event);
        setCanInstall(true);
      }
    };

    window.addEventListener("pwa-install-ready", handleInstallReady);
    return () => {
      window.clearTimeout(checkTimer);
      window.removeEventListener("pwa-install-ready", handleInstallReady);
    };
  }, []);

  const handleCheckUpdate = async () => {
    await checkForUpdate();
    if (!updateAvailable) {
      showToast("\u2713 You\u2019re on the latest version");
    }
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setCanInstall(false);
      setDeferredPrompt(null);
      (window as PWAWindow).__pwa_install_event = null;
      onClose();
    }
  };

  const haptic = (ms = 8) => {
    if ("vibrate" in navigator) navigator.vibrate(ms);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`profile-backdrop ${isOpen ? "profile-backdrop--open" : ""}`}
        onClick={() => {
          haptic();
          onClose();
        }}
        aria-hidden="true"
      />

      {/* Side Panel */}
      <aside
        className={`profile-panel ${isOpen ? "profile-panel--open" : ""}`}
        role="dialog"
        aria-label="Profile & Settings"
      >
        {/* Panel Header */}
        <div className="profile-panel-header">
          <div className="profile-avatar">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/dbboss.png"
              alt="DBboss Logo"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: "11px",
              }}
            />
          </div>
          <div className="profile-header-info">
            <span className="profile-name">DBboss</span>
            <span className="profile-version">v1.0.0 · PWA</span>
          </div>
          <button
            className="profile-close-btn"
            onClick={() => {
              haptic();
              onClose();
            }}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M4 4L14 14M14 4L4 14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="profile-divider" />

        {/* Updates Section */}
        <div className="profile-section-label">App Updates</div>

        {updateAvailable ? (
          <button
            className="profile-menu-item profile-menu-item--accent"
            onClick={() => {
              haptic(15);
              installUpdate();
            }}
            disabled={isUpdating}
          >
            <span className="profile-item-icon">{isUpdating ? "⟳" : "⬇️"}</span>
            <span className="profile-item-text">
              <span className="profile-item-title">
                {isUpdating ? "Updating…" : "Install Update"}
              </span>
              <span className="profile-item-sub">
                New version ready to install
              </span>
            </span>
            {!isUpdating && <span className="profile-item-badge">NEW</span>}
          </button>
        ) : (
          <button
            className="profile-menu-item"
            onClick={() => {
              haptic();
              handleCheckUpdate();
            }}
            disabled={isChecking}
          >
            <span className="profile-item-icon">{isChecking ? "⟳" : "🔄"}</span>
            <span className="profile-item-text">
              <span className="profile-item-title">
                {isChecking ? "Checking…" : "Check for Updates"}
              </span>
              <span className="profile-item-sub">
                Keep the engine up to date
              </span>
            </span>
          </button>
        )}

        {/* Install App Section — only shown when not already installed as PWA */}
        {isStandalone === false && (
          <>
            <div className="profile-divider" style={{ margin: "8px 0" }} />
            <div className="profile-section-label">Installation</div>

            {isIOS ? (
              <div className="profile-ios-install">
                <span
                  style={{ fontSize: 20, marginBottom: 6, display: "block" }}
                >
                  📲
                </span>
                <strong>Install on iOS</strong>
                <p>
                  Tap the <strong>Share</strong> icon in Safari, then{" "}
                  <strong>&ldquo;Add to Home Screen&rdquo;</strong> for the full
                  experience.
                </p>
              </div>
            ) : canInstall ? (
              <button
                className="profile-menu-item profile-menu-item--install"
                onClick={() => {
                  haptic(12);
                  handleInstall();
                }}
              >
                <span className="profile-item-icon">📲</span>
                <span className="profile-item-text">
                  <span className="profile-item-title">Install App</span>
                  <span className="profile-item-sub">
                    Full-screen, works offline
                  </span>
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{ opacity: 0.4, flexShrink: 0 }}
                >
                  <path
                    d="M6 3L11 8L6 13"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : null}
          </>
        )}

        <div className="profile-divider" style={{ margin: "8px 0" }} />

        {/* About Section */}
        <div className="profile-section-label">About</div>
        <div className="profile-about-card">
          <p className="profile-about-text">
            DBboss uses a 6-factor Game-Theory engine to forecast Satta Matka
            panels based on operator liability minimization, temporal cycles,
            and liquidity flow analysis.
          </p>
          <div className="profile-stat-row">
            <div className="profile-stat">
              <span className="profile-stat-val">6</span>
              <span className="profile-stat-label">Score Factors</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-val">12</span>
              <span className="profile-stat-label">Markets</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-val">&infin;</span>
              <span className="profile-stat-label">Offline Cache</span>
            </div>
          </div>
        </div>

        {/* Toast */}
        {toast && <div className="profile-toast">{toast}</div>}
      </aside>
    </>
  );
}
