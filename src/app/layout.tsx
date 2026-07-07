import type { Metadata, Viewport } from "next";
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
        {/* Capture beforeinstallprompt before React mounts to avoid race condition */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.__pwa_install_event = null;
              window.addEventListener('beforeinstallprompt', function(e) {
                e.preventDefault();
                window.__pwa_install_event = e;
                window.dispatchEvent(new CustomEvent('pwa-install-ready'));
              });
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
