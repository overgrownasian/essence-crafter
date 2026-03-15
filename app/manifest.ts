import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Essence Craft",
    short_name: "Essence Craft",
    description: "Fuse essences, forge classes, and build endless progression fantasy paths.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#120d09",
    theme_color: "#120d09",
    icons: [
      {
        src: "/icon?size=192",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/icon?size=512",
        sizes: "512x512",
        type: "image/png"
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png"
      }
    ]
  };
}
