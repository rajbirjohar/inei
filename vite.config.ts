import { existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

emptyDir(resolve(__dirname, 'dist'));

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: {
    lib: {
      entry: [resolve(__dirname, 'src/index.ts')], // required by Vite
      name: 'inei',
      formats: ['es'], // ESM-only
    },
    // 👇 This is what creates dist/index.js, dist/format.js, dist/format-tags.js
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/index.ts'),
        format: resolve(__dirname, 'src/format.ts'),
        'format-tags': resolve(__dirname, 'src/format-tags.ts'),
      },
      output: {
        entryFileNames: '[name].js',
      },
      // external: [] // add runtime deps here if you ever have any
    },
    sourcemap: true,
    minify: false,
    target: 'es2020',
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
