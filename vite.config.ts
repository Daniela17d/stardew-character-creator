import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite'

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

export default defineConfig({
  plugins: [
    tailwindcss(),
    {
      name: 'versions',
      transformIndexHtml: (html) =>
        html
          .replace('%GAME_VERSION%', read('public/assets/catalog.json').gameVersion)
          .replace('%APP_VERSION%', read('package.json').version),
    },
  ],
});
