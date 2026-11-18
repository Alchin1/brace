import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Brace",
    short_name: "Brace",
    description: "Lending limits from live prediction market odds, on Solana devnet.",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0a22",
    theme_color: "#0c0a22",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
