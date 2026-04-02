import { defineConfig, fontProviders } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: {
      enabled: true
    }
  }),
  build: {
    inlineStylesheets: "always",
  },
  fonts: [
    {
      provider: fontProviders.google(),
      name: "Inter",
      cssVariable: "--font-inter",
    },
    {
      provider: fontProviders.google(),
      name: "Playfair Display",
      cssVariable: "--font-playfair",
    },
    {
      provider: fontProviders.google(),
      name: "Dancing Script",
      cssVariable: "--font-dancing",
    },
  ],
});
