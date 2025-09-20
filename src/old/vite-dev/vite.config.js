import vue from '@vitejs/plugin-vue';
import path from 'path';
import fs from 'fs';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { createRequire } from 'module';
import { createVueVNAliasPlugin } from '../src/plugins/vuevn-alias.mjs';
import { createFileApiPlugin } from '../src/plugins/file-api.mjs';
import { createGenerateWatchPlugin } from '../src/plugins/generate-watch.mjs';
import pathLib from '../src/lib/path.mjs';

// Dev config mirroring build essentials. It resolves aliases and Tailwind similarly,
// but uses vite-dev/index.html and dev entry points.

export default function createDevConfig() {
  // Infer paths relative to the installed package
  const cliRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const projectRoot = process.cwd();
  const devRoot = path.join(cliRoot, 'vite-dev');

  const tailwindContent = [
    // Include dev and build templates inside the CLI package
    path.join(cliRoot, 'vite-dev/**/*.{vue,js,ts,jsx,tsx,html}'),
    path.join(cliRoot, 'vite-build/**/*.{vue,js,ts,jsx,tsx,html}'),
    // Engine/editor sources shipped with the CLI
    path.join(cliRoot, 'engine_src/**/*.{vue,js,ts,jsx,tsx}'),
    path.join(cliRoot, 'editor_src/**/*.{vue,js,ts,jsx,tsx}'),
    // Project sources
    path.join(projectRoot, 'generate/**/*.{vue,js,ts,jsx,tsx}'),
    path.join(projectRoot, 'locations/**/*.{vue,js,ts,jsx,tsx}'),
    path.join(projectRoot, 'global/**/*.{vue,js,ts,jsx,tsx}'),
    path.join(projectRoot, 'plugins/**/*.{vue,js,ts,jsx,tsx}'),
    path.join(projectRoot, 'shared/**/*.{vue,js,ts,jsx,tsx}'),
    // Dev HTML entry
    path.join(devRoot, 'index.html'),
  ];

  return {
    // Serve the CLI's dev folder as the root (so / serves vite-dev/index.html)
    root: devRoot,
    base: './',

    plugins: [
      vue(),
      createVueVNAliasPlugin({ projectRoot, cliRoot }),
      createFileApiPlugin({ projectRoot }),
      // Watch project sources and regenerate selectively (@generate), no forced reload
      createGenerateWatchPlugin({ projectRoot }),
      // Serve project assets in dev to mirror build output structure
      {
        name: 'vuevn-static-assets',
        configureServer(server) {
          const { resolveSafe } = pathLib;

          const locationsRoot = path.join(projectRoot, 'locations');
          const globalRoot = path.join(projectRoot, 'global');

          const mime = (p) => {
            const ext = (p && path.extname(p).toLowerCase()) || '';
            switch (ext) {
              case '.png': return 'image/png';
              case '.jpg':
              case '.jpeg': return 'image/jpeg';
              case '.gif': return 'image/gif';
              case '.webp': return 'image/webp';
              case '.svg': return 'image/svg+xml';
              case '.mp3': return 'audio/mpeg';
              case '.wav': return 'audio/wav';
              case '.ogg': return 'audio/ogg';
              case '.mp4': return 'video/mp4';
              case '.webm': return 'video/webm';
              case '.json': return 'application/json';
              case '.txt': return 'text/plain; charset=utf-8';
              default: return 'application/octet-stream';
            }
          };

          server.middlewares.use((req, res, next) => {
            try {
              const url = new URL(req.url, 'http://localhost');
              const p = url.pathname;

              // 1) /global/* → projectRoot/global/*
              if (p.startsWith('/global/')) {
                const filePath = resolveSafe(projectRoot, p);
                if (filePath && filePath.startsWith(globalRoot) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                  res.setHeader('Content-Type', mime(filePath));
                  res.setHeader('Cache-Control', 'no-cache');
                  fs.createReadStream(filePath).pipe(res);
                  return;
                }
              }

              // 2) /locations/* → projectRoot/locations/* (support AssetManager paths)
              if (p.startsWith('/locations/')) {
                const filePath = resolveSafe(projectRoot, p);
                if (filePath && filePath.startsWith(locationsRoot) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                  res.setHeader('Content-Type', mime(filePath));
                  res.setHeader('Cache-Control', 'no-cache');
                  fs.createReadStream(filePath).pipe(res);
                  return;
                }
              }

              // 3) /:location/* → projectRoot/locations/:location/*
              const segs = p.split('/').filter(Boolean);
              if (segs.length >= 2) {
                const [first, ...rest] = segs;
                const candidate = path.join(locationsRoot, first, ...rest);
                if (candidate.startsWith(locationsRoot) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                  res.setHeader('Content-Type', mime(candidate));
                  res.setHeader('Cache-Control', 'no-cache');
                  fs.createReadStream(candidate).pipe(res);
                  return;
                }
              }
            } catch { /* ignore */ }
            next();
          });
        }
      },
    ],

    // Aliases for project/engine/editor are provided by createVueVNAliasPlugin

    css: {
      postcss: {
        plugins: [
          (() => {
            // Load shared Tailwind base config and override content for dev
            const require = createRequire(import.meta.url);
            let baseCfg = {};
            try { baseCfg = require(path.join(cliRoot, 'src', 'lib', 'tailwind.base.cjs')); } catch { baseCfg = {}; }
            const merged = { ...(baseCfg?.default || baseCfg), content: tailwindContent };
            return tailwindcss({ config: merged });
          })(),
          autoprefixer(),
        ],
      },
    },

    optimizeDeps: {
      // Treat project/engine/editor sources as first-class modules (no prebundle)
      exclude: [
        '@generate',
        '@project',
        '@plugins',
        '@locations',
        '@global',
        '@engine',
        '@editor',
        '@crimsonquill/cli',
        '@crimsonquill/engine_src',
        '@crimsonquill/editor_src',
      ],
    },

    server: {
      host: true,
      port: 5173,
      strictPort: false,
      fs: { allow: [projectRoot, cliRoot] },
    },

    // No special build config; this file is for dev/serve.
  };
}
