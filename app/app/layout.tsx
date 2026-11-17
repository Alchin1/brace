import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BoardProvider } from "@/components/BoardProvider";
import { Footer, Header } from "@/components/Chrome";

const sans = Geist({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-geist-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Brace: lending limits from live prediction-market odds", template: "%s | Brace" },
  description:
    "Brace reads Gemini's regulated prediction markets every minute, computes implied volatility onchain on Solana, and sets how much you can borrow.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#141415" },
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
          <main>
            <div className="wrap">{children}</div>
          </main>
          <Footer />
        </BoardProvider>
      </body>
    </html>
  );
}
