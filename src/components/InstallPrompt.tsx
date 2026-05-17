"use client";

import { useEffect, useState } from "react";

export default function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true); // default true to prevent flash
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const isAppInstalled = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    setIsStandalone(isAppInstalled);

    if (isAppInstalled) return;

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    if (isIosDevice) {
      // For iOS, show the prompt after a short delay since it doesn't fire beforeinstallprompt
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // For Android / Desktop Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); // Prevent default mini-infobar
      setDeferredPrompt(e);
      setShowPrompt(true); // Show our custom UI
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the native install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    
    // Clear the deferred prompt variable
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt || isStandalone) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-50 animate-fade-in-up">
      <div className="glass-panel !mb-0 border !border-white/20 !p-5 relative overflow-hidden !bg-black/95 !backdrop-blur-2xl shadow-[0_15px_40px_rgba(0,0,0,0.8)]">
        {/* Shine effect */}
        <div className="absolute top-0 left-0 w-[200%] h-full bg-gradient-to-tr from-transparent via-white/10 to-transparent transform -skew-x-12 translate-x-[-100%] animate-[shine_3s_infinite]" />
        
        <button 
          onClick={handleDismiss}
          className="absolute top-2 right-3 text-white/50 hover:text-white transition-colors text-lg"
          aria-label="Close"
        >
          ✕
        </button>
        
        <h3 className="text-lg font-bold mb-2 text-white">Install DBboss App</h3>
        <p className="text-sm text-white/80 mb-4">
          {isIOS 
            ? "To install on iOS, tap the 'Share' icon at the bottom of Safari and select 'Add to Home Screen'."
            : "Install DBboss Calculator for a better, full-screen experience and automatic updates!"}
        </p>
        
        {!isIOS && (
          <button 
            onClick={handleInstallClick}
            className="w-full glass-button !bg-white/10 hover:!bg-white/20 !border-white/30 !text-white font-bold shadow-[0_0_15px_rgba(255,255,255,0.1)]"
          >
            Install App Now
          </button>
        )}
      </div>
    </div>
  );
}
