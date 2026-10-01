import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

// Emits sw.js with the hashed build assets in its precache list and a cache
// name derived from them, so a new deploy always invalidates the old cache.
function serviceWorker() {
  return {
    name: 'atler-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const assets = Object.keys(bundle)
        .filter(file => /\.(js|css)$/.test(file))
        .sort()
        .map(file => `./${file}`);
      const buildId = createHash('sha256').update(assets.join('\n')).digest('hex').slice(0, 10);
      const source = readFileSync(new URL('./src/sw.template.js', import.meta.url), 'utf8')
        .replace('__BUILD_ID__', buildId)
        .replace('...__ASSETS__', assets.map(a => JSON.stringify(a)).join(',\n  '));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// Which build an error came from: the commit on CI, else the local HEAD.
function release() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  define: { __APP_RELEASE__: JSON.stringify(release()) },
  // GitHub Pages serves the app from /ATLER/, so keep every URL relative.
  base: './',
  plugins: [serviceWorker()],
  test: {
    include: ['test/**/*.test.js'],
  },
});
