import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

import { HazardStrip } from "@/components/ui";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";

// Bricolage Grotesque carries the display and body voice; Geist Mono owns every
// number, address and label. globals.css aliases the font roles onto these.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Argus — an on-chain mandate for AI agents trading on Injective",
  description:
    "An agent can place orders for you. It cannot decide what it is allowed to do. Argus re-derives the price from Injective's oracle precompile and refuses anything outside the owner's signed mandate before the order reaches the exchange.",
  openGraph: {
    title: "Argus — an on-chain mandate for AI agents trading on Injective",
    description: "The agent proposes. The chain decides. Live and verified on Injective EVM testnet.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bricolage.variable} ${GeistMono.variable}`}
    >
      <head>
        {/* Set the theme before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('argus-theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <div className="relative z-10 flex min-h-screen flex-col">
          <HazardStrip />
          <TopNav />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
