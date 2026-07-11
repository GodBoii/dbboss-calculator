"use client";

import { useState, useEffect, useCallback } from "react";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";
import { APP_VERSION } from "@/lib/app-version";
import {
  BET_COPY_FORMATS,
  BET_COPY_TEXT_STYLES,
  DEFAULT_BET_COPY_FORMAT,
  DEFAULT_BET_COPY_TEXT_STYLE,
  getSavedBetCopyFormat,
  getSavedBetCopyTextStyle,
  saveBetCopyFormat,
  saveBetCopyTextStyle,
  type BetCopyFormatId,
  type BetCopyTextStyleId,
} from "@/lib/bet-copy-format";

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
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
  const [betFormat, setBetFormat] = useState<BetCopyFormatId>(DEFAULT_BET_COPY_FORMAT);
  const [betTextStyle, setBetTextStyle] = useState<BetCopyTextStyleId>(DEFAULT_BET_COPY_TEXT_STYLE);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBetFormat(getSavedBetCopyFormat());
      setBetTextStyle(getSavedBetCopyTextStyle());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Declared before effects so it can be referenced in them
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (updateAvailable) {
      // setTimeout keeps setState in a callback, not synchronously in the effect body
      const t = window.setTimeout(
        () => showToast("🎉 New update available!"),
        0,
      );
      return () => window.clearTimeout(t);
    }
  }, [updateAvailable, showToast]);

  const handleCheckUpdate = async () => {
    await checkForUpdate();
    if (!updateAvailable) showToast("✓ You're on the latest version");
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
        {/* Header */}
        <div className="profile-panel-header">
          <div className="profile-avatar">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/lakshmi-boss.png"
              alt="Lakshmi Boss logo"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: "11px",
              }}
            />
          </div>
          <div className="profile-header-info">
            <span className="profile-name">Lakshmi Boss</span>
            <span className="profile-version">v{APP_VERSION} - PWA</span>
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

        <div className="profile-section-label">Bet Copy Style</div>
        <p className="profile-setting-help">
          Changes only how copied bets look. Numbers and their order stay exactly the same.
        </p>
        <div className="bet-format-grid" role="radiogroup" aria-label="Copied bet style">
          {BET_COPY_FORMATS.map((format) => (
            <button
              key={format.id}
              type="button"
              role="radio"
              aria-checked={betFormat === format.id}
              className={`bet-format-option ${betFormat === format.id ? "bet-format-option--active" : ""}`}
              onClick={() => {
                haptic();
                setBetFormat(format.id);
                saveBetCopyFormat(format.id);
                showToast(`Copy style saved: ${format.label}`);
              }}
            >
              <span className="bet-format-name">{format.label}</span>
              <span className="bet-format-preview">{format.preview}</span>
            </button>
          ))}
        </div>

        <div className="bet-style-heading">Text style</div>
        <div className="bet-text-style-grid" role="radiogroup" aria-label="Copied bet text style">
          {BET_COPY_TEXT_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              role="radio"
              aria-checked={betTextStyle === style.id}
              className={`bet-text-style-option bet-text-style-option--${style.id} ${betTextStyle === style.id ? "bet-format-option--active" : ""}`}
              onClick={() => {
                haptic();
                setBetTextStyle(style.id);
                saveBetCopyTextStyle(style.id);
                showToast(`Text style saved: ${style.label}`);
              }}
            >
              <span>{style.label}</span>
              <small>123 124</small>
            </button>
          ))}
        </div>

        <div className="profile-divider" style={{ margin: "14px 0 8px" }} />

        {/* Updates */}
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

        <div className="profile-divider" style={{ margin: "8px 0" }} />

        {/* About */}
        <div className="profile-section-label">About</div>
        <div className="profile-about-card">
          <p className="profile-about-text">
            Lakshmi Boss uses a 6-factor Game-Theory engine to forecast Satta Matka
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

        {toast && <div className="profile-toast">{toast}</div>}
      </aside>
    </>
  );
}
