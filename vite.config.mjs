/**
 * The browser bundle (DECISIONS.md D-0059 R1, as the page's rebuild leaves it).
 *
 * **One entry, no dev server, no HMR.** `scripts/page.mjs build` calls this,
 * and the output joins Tailwind's CSS and the copied files under
 * `dist/page/`, where every served byte is named by digest in
 * `page.manifest.json`. Nothing here is run at request time.
 *
 * `manifest: false`: Vite's own manifest maps source names to emitted ones,
 * which is a different question from "are these the recorded bytes".
 * `page.manifest.json` answers the second, and is the one CI checks.
 */
import react from "@vitejs/plugin-react";

export default {
  plugins: [react()],
  build: {
    outDir: "dist/page",
    emptyOutDir: false,
    manifest: false,
    rollupOptions: {
      input: "page/client/main.tsx",
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
};
