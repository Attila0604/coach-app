import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RGYM Coach",
    short_name: "RGYM Coach",
    description: "Coaching-Dashboard für Rákosi Gym.",
    start_url: "/coach",
    scope: "/",
    display: "standalone",
    background_color: "#10151D",
    theme_color: "#10151D",
    lang: "de",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
