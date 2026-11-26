import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/navbar";
import { StravaStatusToast } from "@/components/strava-status-toast";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "PolyRunner",
    template: "%s · PolyRunner",
  },
  description:
    "Pronostica i tempi di gara dei tuoi amici con crediti virtuali. Un gioco sociale per runner.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl px-4 pb-16">{children}</main>
        <Toaster theme="dark" position="bottom-right" />
        <Suspense>
          <StravaStatusToast />
        </Suspense>
      </body>
    </html>
  );
}
