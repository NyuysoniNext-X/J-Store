import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

// Manual replacement for the removed @lovable.dev/vite-tanstack-config wrapper.
// That package used to silently bundle: tanstackStart, viteReact, tailwindcss,
// tsConfigPaths, the cloudflare plugin (build-only), a dev-only "component
// tagger" for Lovable's visual editor, VITE_* env injection, the "@" path
// alias, and React/TanStack dedupe.
//
// Notes on what's below vs. what's dropped:
// - VITE_* env vars are injected by Vite itself automatically — no plugin needed.
// - tsConfigPaths() reads the "@/*" alias from tsconfig.json, so no manual
//   resolve.alias entry is required.
// - The Lovable component tagger and its sandbox/preview-detection logic are
//   dropped entirely — those only existed to support Lovable's hosted editor.
// - `server.entry` below keeps building from src/server.ts (our SSR error
//   wrapper), matching the previous config's behavior.
export default defineConfig({
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
  },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart({
      server: { entry: "./src/server.ts" },
    }),
    viteReact(),
  ],
});
