import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BoardProvider } from "@/components/BoardProvider";
import { Footer, Header } from "@/components/Chrome";

const sans = Geist({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"], variable: "--font-geist-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-geist-mono", display: "swap" });

const SITE_URL = "https://brace-ivory.vercel.app";
const TITLE = "Brace: lending limits from live prediction-market odds";
const DESCRIPTION =
  "Brace reads Gemini's regulated prediction markets every minute, computes implied volatility onchain on Solana, and sets how much you can borrow.";

// opengraph-image.png, twitter-image.png, icon.png, apple-icon.png and favicon.ico in this folder
// are picked up by Next and added to the head automatically.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s | Brace" },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Brace",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" },
  ],
};

// Applies the saved theme before first paint so there is no flash.
const themeScript = `try{var t=localStorage.getItem("brace-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <BoardProvider>
          <Header />
          <main id="main">
            <div className="wrap">{children}</div>
          </main>
          <Footer />
        </BoardProvider>
      </body>
    </html>
  );
}
