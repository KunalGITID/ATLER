import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// The build's commit, shown on the You tab so bug reports name a version.
const version = process.env.GITHUB_SHA?.slice(0, 7) ?? (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'dev'; }
})();

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false, // registered in main.tsx, after the first paint
      manifest: {
        name: 'Atler',
        short_name: 'Atler',
        description: 'Subscriptions and spending: see your month before it happens.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a0a0a',
        theme_color: '#0a0a0a',
        // Long-press shortcuts (Android and desktop; iOS doesn't offer them to web apps).
        shortcuts: [
          { name: 'Add an expense', short_name: 'Add expense', url: './?do=add-expense', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Add a plan', short_name: 'Add plan', url: './?do=add-plan', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Calendar', url: './#/calendar', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'What I spent', short_name: 'Spent', url: './#/spent', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }] },
        ],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,woff2}'],
        // pdf.js (~1.6 MB) is only for PDF statements; it's fetched when used.
        globIgnores: ['**/pdf*.js', '**/pdf*.mjs'],
      },
    }),
  ],
  define: { __APP_VERSION__: JSON.stringify(version) },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
