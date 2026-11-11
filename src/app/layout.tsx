import type { Metadata, Viewport } from "next";
import { Barlow_Condensed } from "next/font/google";
import { SerwistProvider } from "@serwist/turbopack/react";
import "./globals.css";

// Números e títulos em letra condensada (painel de instrumentos); o resto usa a letra do sistema.
const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Mota", template: "%s · Mota" },
  description: "Poupança para comprar a mota.",
  applicationName: "Mota",
  appleWebApp: {
    capable: true,
    title: "Mota",
    // Tema sempre escuro: o conteúdo passa por baixo da barra de estado (safe areas no CSS).
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false, email: false, address: false },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // O Next só gera "mobile-web-app-capable"; versões antigas do iOS precisam desta.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0c0e",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-PT" className={barlow.variable}>
      <body className="min-h-dvh antialiased">
        <SerwistProvider
          swUrl="/serwist/sw.js"
          disable={process.env.NODE_ENV === "development"}
          reloadOnOnline={false}
        >
          {children}
        </SerwistProvider>
      </body>
    </html>
  );
}
