import { existsSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

emptyDir(resolve(import.meta.dirname, "dist"));

export default defineConfig({
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") },
  },
  build: {
    lib: {
      entry: [resolve(import.meta.dirname, "src/index.ts")], // required by Vite
      name: "inei",
      formats: ["es"], // ESM-only
    },
    // 👇 This is what creates dist/index.js, dist/format.js, dist/format-tags.js
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "src/index.ts"),
        format: resolve(import.meta.dirname, "src/format.ts"),
        "format-tags": resolve(import.meta.dirname, "src/format-tags.ts"),
        xmp: resolve(import.meta.dirname, "src/xmp.ts"),
      },
      output: {
        entryFileNames: "[name].js",
      },
      // external: [] // add runtime deps here if you ever have any
    },
    sourcemap: true,
    minify: false,
    target: "es2020",
  },
});

function emptyDir(dir: string) {
  if (!existsSync(dir)) {
    return;
  }
  for (const f of readdirSync(dir)) {
    rmSync(resolve(dir, f), { recursive: true, force: true });
  }
}
