// Vite plugin: watch project sources and regenerate selectively without forcing full reload
import path from 'path';
import { createRequire } from 'module';

export function createGenerateWatchPlugin({ projectRoot }) {
  return {
    name: 'vuevn-generate-watch',
    configureServer(server) {
      try {
        const req = createRequire(import.meta.url);
        const gen = req('../generate/index.js');
        const w = server.watcher;
        const toProj = (p) => path.join(projectRoot, p);

        const roots = {
          global: toProj('global'),
          locations: toProj('locations'),
          plugins: toProj('plugins'),
        };

        const isUnder = (p, root) => p.startsWith(root + path.sep) || p === root;
        const isTextFile = (p) => p.endsWith('.ts') && (p.includes(`${path.sep}texts${path.sep}`));
        const isTsOrVue = (p) => /\.(ts|vue)$/i.test(p);

        let pending = null;
        function schedule(fn, delay = 100) {
          if (pending) clearTimeout(pending);
          pending = setTimeout(async () => {
            pending = null;
            try {
              await fn();
              // Do not force full reload; let Vite's HMR decide based on changed modules
            } catch (e) {
              console.error('[vuevn] watcher error:', e && e.message ? e.message : e);
            }
          }, delay);
        }

        // Texts: add/change/unlink → regenerate texts only
        const onText = () => schedule(() => gen.runGenerateTexts({ projectRoot, verbose: false }), 80);

        // Project structure (global/locations, excluding texts): add/unlink → regenerate project
        const onProjectStructure = () => schedule(() => gen.runGenerateProject({ projectRoot, verbose: false }), 120);

        // Plugins structure: add/unlink → regenerate engine overlay
        const onPluginsStructure = () => schedule(() => gen.runGenerateEngine({ projectRoot, verbose: false }), 120);

        // Attach watchers
        w.add([roots.global, roots.locations, roots.plugins, toProj('config.ts')]);

        w.on('add', (p) => {
          if (isUnder(p, roots.plugins)) return onPluginsStructure();
          if (isUnder(p, roots.global) || isUnder(p, roots.locations)) {
            if (isTextFile(p)) return onText();
            if (isTsOrVue(p)) return onProjectStructure();
          }
        });
        w.on('unlink', (p) => {
          if (isUnder(p, roots.plugins)) return onPluginsStructure();
          if (isUnder(p, roots.global) || isUnder(p, roots.locations)) {
            if (isTextFile(p)) return onText();
            if (isTsOrVue(p)) return onProjectStructure();
          }
        });
        w.on('change', (p) => {
          // Only texts require regeneration on content change
          if ((isUnder(p, roots.global) || isUnder(p, roots.locations)) && isTextFile(p)) {
            return onText();
          }
        });

        // config.ts change → regenerate everything
        w.on('change', (p) => {
          if (p === toProj('config.ts')) {
            return schedule(() => gen.runGenerate({ projectRoot, verbose: false }), 150);
          }
        });
      } catch (e) {
        console.warn('[vuevn] project watcher disabled:', e && e.message ? e.message : e);
      }
    },
  };
}

