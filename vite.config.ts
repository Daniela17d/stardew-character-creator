import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/stardew-farmer-creator/',
  plugins: [
    tailwindcss(),
  ],
});
