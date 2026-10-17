import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/stardew-character-creator/',
  plugins: [
    tailwindcss(),
  ],
});
