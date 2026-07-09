import type { Metadata, Viewport } from "next";
import Script from "next/script";
import NativeInstallPrompt from "@/components/NativeInstallPrompt";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "DBboss Calculator",
  description: "Game-Theory based Satta Matka prediction engine",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DBboss",
  },
};

export const viewport: Viewport = {
  themeColor: "#080808",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/dbboss.png" type="image/png" />
        <link rel="apple-touch-icon" href="/dbboss.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <Script
          id="pwa-install-event-capture"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                if (window.__dbbossPwaInstallCaptureReady) return;
                window.__dbbossPwaInstallCaptureReady = true;
                window.addEventListener("beforeinstallprompt", function (event) {
                  event.preventDefault();
                  window.__dbbossDeferredInstallPrompt = event;
                  window.dispatchEvent(new CustomEvent("dbboss:pwa-beforeinstallprompt"));
                });
                window.addEventListener("appinstalled", function () {
                  window.__dbbossDeferredInstallPrompt = undefined;
                  window.__dbbossPwaInstalled = true;
                  window.dispatchEvent(new CustomEvent("dbboss:pwa-appinstalled"));
                });
              })();
            `,
          }}
        />
      </head>
      <body>
        <PwaRegister />
        <NativeInstallPrompt />
        {children}
      </body>
    </html>
  );
}
