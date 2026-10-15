import path from 'node:path';
import solid from '@solidjs/vite-plugin';
import { defineConfig, type Plugin } from 'vite';
import content from './plugins/content.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

// The playground uses the development builds of the workspace packages,
// which keep full error messages. Solid's own copy of seroval, used for
// hydration, is not affected.
const DEV_BUILDS: Record<string, string> = {
  seroval: path.join(ROOT, 'packages/seroval/dist/dev/index.js'),
  'seroval-plugins/web': path.join(ROOT, 'packages/plugins/dist/dev/web.js'),
};

function workspaceDevBuilds(): Plugin {
  const importers = [
    path.join(import.meta.dirname, 'src'),
    path.join(ROOT, 'packages'),
  ];
  return {
    name: 'seroval-workspace-dev-builds',
    enforce: 'pre',
    resolveId(id, importer) {
      if (
        Object.hasOwn(DEV_BUILDS, id) &&
        importer &&
        importers.some(dir => importer.startsWith(dir))
      ) {
        return DEV_BUILDS[id];
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    workspaceDevBuilds(),
    content(ROOT),
    solid({
      ssr: true,
      // Pages are prerendered to static files, so each one renders in full.
      start: { renderMode: 'async' },
    }),
  ],
  build: {
    // The playground editor (CodeMirror and the development builds of
    // seroval) is one large chunk, but only the playground page loads it.
    chunkSizeWarningLimit: 700,
  },
  server: {
    fs: {
      // The site reads the workspace packages outside this folder.
      allow: [ROOT],
    },
  },
});
