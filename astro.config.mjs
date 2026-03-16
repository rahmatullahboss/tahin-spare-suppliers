import { defineConfig, fontProviders } from "astro/config";

export default defineConfig({
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
