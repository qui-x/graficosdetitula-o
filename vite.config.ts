import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  root: "app",
  base: "/graficosdetitula-o/",
  publicDir: "public",
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["dados-exemplo.csv", "favicon.svg"],
      pwaAssets: {
        image: "public/favicon.svg",
        preset: "minimal-2023",
        overrideManifestIcons: true
      },
      manifest: {
        id: "/graficosdetitula-o/",
        name: "Gráficos de investigação",
        short_name: "Gráficos",
        description: "Editor manual para visualizar leituras de pH por volume e calcular ΔpH/ΔV.",
        start_url: "/graficosdetitula-o/",
        scope: "/graficosdetitula-o/",
        display: "standalone",
        orientation: "any",
        background_color: "#edf3f8",
        theme_color: "#101d2b",
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{html,js,css,svg,png,ico,webmanifest,csv}"]
      }
    })
  ],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: false
  }
});
