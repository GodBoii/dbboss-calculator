"use client";

import { usePWAUpdate } from "@/hooks/usePWAUpdate";
import { useEffect, useState } from "react";

export default function UpdateButton() {
  const {
    updateAvailable,
    isChecking,
    isUpdating,
    checkForUpdate,
    installUpdate,
  } = usePWAUpdate();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    if (!updateAvailable) return;

    const timer = window.setTimeout(() => {
      setToastMessage("New update available!");
      setShowToast(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [updateAvailable]);

  const handleCheckUpdate = async () => {
    await checkForUpdate();

    if (!updateAvailable) {
      setToastMessage("You're on the latest version");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const handleInstallUpdate = async () => {
    setToastMessage("Updating app...");
    setShowToast(true);
    await installUpdate();
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        {updateAvailable ? (
          <button
            onClick={handleInstallUpdate}
            disabled={isUpdating}
            className="glass-button active !px-6 !py-3 !text-base font-semibold shadow-lg animate-pulse-subtle"
            style={{
              background:
                "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.2))",
              borderColor: "rgba(34, 197, 94, 0.5)",
            }}
          >
            {isUpdating ? "Updating..." : "Install Update"}
          </button>
        ) : (
          <button
            onClick={handleCheckUpdate}
            disabled={isChecking}
            className="glass-button !px-4 !py-2 !text-sm shadow-md hover:shadow-lg transition-all"
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              borderColor: "rgba(255, 255, 255, 0.2)",
            }}
          >
            {isChecking ? "Checking..." : "Check Updates"}
          </button>
        )}
      </div>

      {showToast && (
        <div
          className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down"
          style={{
            maxWidth: "90%",
            width: "320px",
          }}
        >
          <div
            className="glass-panel !py-3 !px-4 text-center shadow-xl"
            style={{
              background: "rgba(0, 0, 0, 0.9)",
              borderColor: "rgba(255, 255, 255, 0.3)",
            }}
          >
            <p className="text-sm font-medium">{toastMessage}</p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse-subtle {
          0%,
          100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.02);
            opacity: 0.95;
          }
        }

        @keyframes slide-down {
          from {
            transform: translate(-50%, -100%);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }

        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }

        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
