import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'node:child_process';

// The build's commit, shown on the You tab so bug reports name a version.
const version = process.env.GITHUB_SHA?.slice(0, 7) ?? (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'dev'; }
})();

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
