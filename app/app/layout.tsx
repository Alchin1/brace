import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { BoardProvider } from "@/components/BoardProvider";
import { Footer, Header } from "@/components/Chrome";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Brace risk board", template: "%s | Brace" },
  description: "Borrowing limits set every minute from Gemini prediction-market odds, computed onchain on Solana devnet.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
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
