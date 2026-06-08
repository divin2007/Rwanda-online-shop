import type { Metadata } from "next";
import { JetBrains_Mono, Work_Sans } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { TacticalToaster } from "@/components/ui/TacticalToaster";
import { NavigationProgressBar } from "@/components/ui/NavigationProgressBar";

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RMF | Rwanda Market Facilitator",
  description: "Official digital gateway to Rwanda's public markets. Professional facilitation for buyers, sellers, and logistics.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RMF",
  },
};

export const viewport = {
  themeColor: "#ff6b00",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${workSans.variable} ${jetBrainsMono.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased font-sans bg-background-main text-text-primary">
        <LanguageProvider>
          <AuthProvider>
            <CartProvider>
              <WishlistProvider>
                <TacticalToaster />
                <Suspense fallback={null}>
                  <NavigationProgressBar />
                </Suspense>
                {children}
              </WishlistProvider>
            </CartProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
