"use client";

import { useState, useEffect } from "react";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfilePanel({ isOpen, onClose }: ProfilePanelProps) {
  const { updateAvailable, isChecking, isUpdating, checkForUpdate, installUpdate } = usePWAUpdate();
  const [toast, setToast] = useState<string | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(true);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Show toast when update becomes available
  useEffect(() => {
    if (updateAvailable) {
      showToast("🎉 New update available!");
    }
  }, [updateAvailable]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleCheckUpdate = async () => {
    await checkForUpdate();
    if (!updateAvailable) {
      showToast("✓ You're on the latest version");
    }
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setCanInstall(false);
      setDeferredPrompt(null);
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
        onClick={() => { haptic(); onClose(); }}
        aria-hidden="true"
      />

      {/* Side Panel */}
      <aside className={`profile-panel ${isOpen ? "profile-panel--open" : ""}`} role="dialog" aria-label="Profile & Settings">
        {/* Panel Header */}
        <div className="profile-panel-header">
          <div className="profile-avatar">
            <span style={{ fontSize: 20 }}>◈</span>
          </div>
          <div className="profile-header-info">
            <span className="profile-name">DBboss</span>
            <span className="profile-version">v1.0.0 · PWA</span>
          </div>
          <button className="profile-close-btn" onClick={() => { haptic(); onClose(); }} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="profile-divider" />

        {/* Updates Section */}
        <div className="profile-section-label">App Updates</div>

        {updateAvailable ? (
          <button
            className="profile-menu-item profile-menu-item--accent"
            onClick={() => { haptic(15); installUpdate(); }}
            disabled={isUpdating}
          >
            <span className="profile-item-icon">{isUpdating ? "⟳" : "⬇️"}</span>
            <span className="profile-item-text">
              <span className="profile-item-title">{isUpdating ? "Updating…" : "Install Update"}</span>
              <span className="profile-item-sub">New version ready to install</span>
            </span>
            {!isUpdating && <span className="profile-item-badge">NEW</span>}
          </button>
        ) : (
          <button
            className="profile-menu-item"
            onClick={() => { haptic(); handleCheckUpdate(); }}
            disabled={isChecking}
          >
            <span className="profile-item-icon">{isChecking ? "⟳" : "🔄"}</span>
            <span className="profile-item-text">
              <span className="profile-item-title">{isChecking ? "Checking…" : "Check for Updates"}</span>
              <span className="profile-item-sub">Keep the engine up to date</span>
            </span>
          </button>
        )}

        {/* Install App Section — only if not already installed */}
        {!isStandalone && (
          <>
            <div className="profile-divider" style={{ margin: "8px 0" }} />
            <div className="profile-section-label">Installation</div>

            {isIOS ? (
              <div className="profile-ios-install">
                <span style={{ fontSize: 20, marginBottom: 6, display: "block" }}>📲</span>
                <strong>Install on iOS</strong>
                <p>Tap the <strong>Share</strong> icon in Safari, then <strong>"Add to Home Screen"</strong> for the full experience.</p>
              </div>
            ) : canInstall ? (
              <button
                className="profile-menu-item profile-menu-item--install"
                onClick={() => { haptic(12); handleInstall(); }}
              >
                <span className="profile-item-icon">📲</span>
                <span className="profile-item-text">
                  <span className="profile-item-title">Install App</span>
                  <span className="profile-item-sub">Full-screen, works offline</span>
                </span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.4, flexShrink: 0 }}>
                  <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
            DBboss uses a 6-factor Game-Theory engine to forecast Satta Matka panels based on operator liability minimization, temporal cycles, and liquidity flow analysis.
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
              <span className="profile-stat-val">∞</span>
              <span className="profile-stat-label">Offline Cache</span>
            </div>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="profile-toast">{toast}</div>
        )}
      </aside>
    </>
  );
}
