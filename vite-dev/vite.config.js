import vue from '@vitejs/plugin-vue';
import path from 'path';
import fs from 'fs';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { createVueVNAliasPlugin } from '../src/plugins/vuevn-alias.js';

// Dev config mirroring build essentials. It resolves aliases and Tailwind similarly,
// but uses vite-dev/index.html and dev entry points.

export default function createDevConfig() {
  // Infer paths relative to the installed package
  const cliRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const projectRoot = process.cwd();

  const sourceHtml = path.join(cliRoot, 'vite-dev', 'index.html');

  const tailwindContent = [
    path.join(cliRoot, 'vite-build/**/*.{vue,js,ts,jsx,tsx,html}'),
    path.join(cliRoot, 'engine_src/**/*.{vue,js,ts,jsx,tsx}'),
    path.join(projectRoot, 'generate/**/*.{vue,js,ts,jsx,tsx}'),
    path.join(projectRoot, 'locations/**/*.{vue,js,ts,jsx,tsx}'),
    path.join(projectRoot, 'global/**/*.{vue,js,ts,jsx,tsx}'),
    path.join(projectRoot, 'shared/**/*.{vue,js,ts,jsx,tsx}'),
    sourceHtml,
  ];

  return {
    root: projectRoot,
    base: './',

    plugins: [
      vue(),
      createVueVNAliasPlugin({ projectRoot, cliRoot }),
    ],

    resolve: {
      alias: {
        // Ensure project deps are used
        'vue': path.join(projectRoot, 'node_modules', 'vue'),
        'pinia': path.join(projectRoot, 'node_modules', 'pinia'),
        'pinia-plugin-persistedstate': path.join(projectRoot, 'node_modules', 'pinia-plugin-persistedstate'),
      }
    },

    css: {
      postcss: {
        plugins: [
          tailwindcss({
            // Prefer vite-dev/tailwind; falls back to vite-build/tailwind
            config: fs.existsSync(path.join(cliRoot, 'vite-dev', 'tailwind.config.js'))
              ? path.join(cliRoot, 'vite-dev', 'tailwind.config.js')
              : path.join(cliRoot, 'vite-build', 'tailwind.config.js'),
            content: tailwindContent,
          }),
          autoprefixer(),
        ],
      },
    },

    server: {
      host: true,
      port: 5173,
      strictPort: false,
      fs: { allow: [projectRoot, cliRoot] },
    },

    build: {
      // Dev config won’t be used for production build; placeholder
      outDir: path.join(projectRoot, 'dist-dev'),
      emptyOutDir: false,
      rollupOptions: {
        input: { index: sourceHtml },
      },
    },
  };
}

