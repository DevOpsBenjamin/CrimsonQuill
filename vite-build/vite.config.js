import vue from '@vitejs/plugin-vue';
import { viteSingleFile } from 'vite-plugin-singlefile';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { createVueVNAliasPlugin } from '../src/plugins/vuevn-alias.js';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

export default function createBuildConfig({ projectRoot, cliRoot, outDir }) {
  const sourceHtml = path.join(cliRoot, 'vite-build', 'index.html');
  const outAbs = path.resolve(projectRoot, outDir || 'dist');

  // Read project package.json for name and version
  let projectName = 'game';
  let projectVersion = '1.0.0';
  try {
    const projectPkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    projectName = projectPkg.name || 'game';
    projectVersion = projectPkg.version || '1.0.0';
  } catch (e) {
    console.warn('Could not read project package.json, using defaults');
  }

  const tailwindContent = [
    // CLI package files
    path.join(cliRoot, 'vite-build/**/*.{vue,js,ts,jsx,tsx,html}'),
    path.join(cliRoot, 'engine_src/**/*.{vue,js,ts,jsx,tsx}'),
    // Project files  
    path.join(projectRoot, 'generate/**/*.{vue,js,ts,jsx,tsx}'),
    path.join(projectRoot, 'locations/**/*.{vue,js,ts,jsx,tsx}'),
    path.join(projectRoot, 'global/**/*.{vue,js,ts,jsx,tsx}'),
    path.join(projectRoot, 'plugins/**/*.{vue,js,ts,jsx,tsx}'),
    path.join(projectRoot, 'shared/**/*.{vue,js,ts,jsx,tsx}'),
    // Include the source HTML
    sourceHtml,
  ];
  // Note: avoid noisy debug logs; keep output clean

  return {
    root: projectRoot,
    base: './',

    plugins: [
      vue(),
      viteSingleFile(),
      createVueVNAliasPlugin({ projectRoot, cliRoot }),
      // Custom plugin to move HTML to correct location
      {
        name: 'move-html-output',
        writeBundle() {
          const wrongPath = path.join(outAbs, 'node_modules/@vuevn/cli/vite-build/index.html');
          const outputFilename = `${projectName}-${projectVersion}.html`;
          const correctPath = path.join(outAbs, outputFilename);

          if (fs.existsSync(wrongPath)) {
            fs.copyFileSync(wrongPath, correctPath);
            // Clean up wrong structure
            fs.rmSync(path.join(outAbs, 'node_modules'), { recursive: true, force: true });
          }
        }
      }
    ],

    optimizeDeps: {
      exclude: ['@vuevn/cli']
    },

    css: {
      postcss: {
        plugins: [
          (() => {
            // Load Tailwind config and override content to avoid scanning node_modules
            const require = createRequire(import.meta.url);
            let baseCfg = {};
            try { baseCfg = require(path.join(__dirname, 'tailwind.config.js')); } catch { baseCfg = {}; }
            const merged = { ...(baseCfg?.default || baseCfg), content: tailwindContent };
            return tailwindcss({ config: merged });
          })(),
          autoprefixer()
        ],
      },
    },

    build: {
      outDir: outAbs,
      emptyOutDir: false,
      rollupOptions: {
        input: {
          index: sourceHtml
        },
      },
    },

    ssr: {
      noExternal: ['@vuevn/cli']
    },
  };
}
