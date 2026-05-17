import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DBboss Calculator",
  description: "Mobile First Calculator App",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DBboss Calculator"
  }
};

export const viewport: Viewport = {
  themeColor: "#120A2B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import InstallPrompt from "../components/InstallPrompt";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body>
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
