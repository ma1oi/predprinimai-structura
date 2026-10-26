import type { Metadata } from "next";
import localFont from "next/font/local";
import { SmoothScroll } from "@/components/smooth-scroll";
import { site } from "@/lib/site-metadata";
import "lenis/dist/lenis.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource/golos-text/400.css";
import "./globals.css";

const neueMachina = localFont({
  src: "../public/fonts/ppneuemachina-ultrabold.woff2",
  weight: "800",
  style: "normal",
  display: "swap",
  variable: "--font-neue-machina",
});

const leoHand = localFont({
  src: "../public/fonts/leohand.ttf",
  weight: "500",
  style: "normal",
  display: "swap",
  variable: "--font-leo-hand",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: "Предпринимай — фестиваль молодых предпринимателей",
  description: "20 ноября, Ярославль. Один день, чтобы услышать тех, кто уже вырос, и познакомиться с теми, кто растёт рядом.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${neueMachina.variable} ${leoHand.variable}`}>
      <body><SmoothScroll />{children}</body>
    </html>
  );
}
