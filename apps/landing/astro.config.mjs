import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

const hiddenSitemapPaths = new Set(["/features", "/tax-advisory", "/try-now"]);

export default defineConfig({
  // Replace with your production domain
  site: "https://ella.tax",
  output: "static",
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    sitemap({
      changefreq: "weekly",
      priority: 0.7,
      filter: (page) => {
        const pathname = new URL(page).pathname.replace(/\/$/, "");
        return !hiddenSitemapPaths.has(pathname);
      },
    }),
  ],
  build: {
    inlineStylesheets: "auto",
  },
  compressHTML: true,
});
