"use strict";

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function resolveModulePath(mod, projectRoot) {
  try {
    const req = createRequire(path.join(projectRoot, "package.json"));
    return req.resolve(mod);
  } catch {}
  try { return require.resolve(mod); } catch { return null; }
}

function gameEntryPlugin() {
  return {
    name: "vuevn-game-entry",
    resolveId(id) {
      if (id === "/@vuevn/game-entry.js") return id;
    },
    load(id) {
      if (id === "/@vuevn/game-entry.js") {
        return `
          import { createApp, h } from 'vue';
          const Root = { render() { return h('div', { id: 'app-root' }, 'VueVN Build OK'); } };
          createApp(Root).mount('#app');
          console.log('[vuevn] production game bootstrap (minimal)');
        `;
      }
    },
  };
}

async function buildGame({ projectRoot, config, outDir }) {
  const vitePath = resolveModulePath("vite", projectRoot);
  if (!vitePath) throw new Error("Vite is not installed in the project. Run: npm i -D vite @vitejs/plugin-vue");
  const vite = await import(vitePath);
  let vuePlugin = undefined;
  const vuePath = resolveModulePath("@vitejs/plugin-vue", projectRoot);
  if (vuePath) {
    const mod = await import(vuePath);
    vuePlugin = mod.default || mod;
  }

  const cliRoot = path.resolve(__dirname, "../..");
  const gameHtmlPath = path.join(cliRoot, "html", "game.html");

  const plugins = [gameEntryPlugin()];
  if (vuePlugin) plugins.push(vuePlugin());

  const outAbs = path.resolve(projectRoot, outDir || "dist");

  await vite.build({
    root: projectRoot,
    plugins,
    resolve: {
      alias: {
        "@project": projectRoot,
        "@locations": path.join(projectRoot, "locations"),
        "@global": path.join(projectRoot, "global"),
        "@plugins": path.join(projectRoot, "plugins"),
        "@generate": path.join(projectRoot, "generate"),
        "@engine": path.join(cliRoot, "engine_src"),
      },
    },
    build: {
      outDir: outAbs,
      emptyOutDir: false,
      rollupOptions: {
        input: gameHtmlPath,
      },
    },
  });
}

module.exports = { buildGame };
