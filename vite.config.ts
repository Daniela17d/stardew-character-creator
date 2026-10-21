import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite'

const { version } = JSON.parse(readFileSync(new URL('package.json', import.meta.url), 'utf8'));
const { gameVersion } = JSON.parse(readFileSync(new URL('public/assets/catalog.json', import.meta.url), 'utf8'));

export default defineConfig({
  base: '/stardew-farmer-creator/',
  plugins: [
    tailwindcss(),
    {
      name: 'versions',
      transformIndexHtml: (html) => html.replace('%GAME_VERSION%', gameVersion).replace('%APP_VERSION%', version),
    },
  ],
});
