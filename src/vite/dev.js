"use strict";

const path = require("path");
const { createRequire } = require("module");
const fs = require("fs");

function optional(mod, projectRoot) {
  // Prefer resolving from the installed CLI package inside the project (handles file: symlink)
  try {
    const reqFromProject = createRequire(path.join(projectRoot, 'package.json'));
    const cliPkg = reqFromProject.resolve('@vuevn/cli/package.json');
    const reqCli = createRequire(cliPkg);
    return reqCli(mod);
  } catch {}
  // Fallback to normal resolution
  try { return require(mod); } catch {}
  try {
    const req = createRequire(path.join(projectRoot, "package.json"));
    return req(mod);
  } catch {}
  return null;
}

function editorInjectionPlugin({ title = "VueVN Editor", enabled = true } = {}) {
  return {
    name: "vuevn-editor-injection",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!enabled) return next();
        if (req.url === "/" || req.url === "/index.html") {
          const cliRoot = server.config.resolve.alias.find(a => a.find) ? undefined : undefined;
          // Serve physical HTML from package
          const pkgRoot = path.resolve(__dirname, "../..");
          const htmlPath = path.join(pkgRoot, "vite-dev", "index.html");
          try {
            const html = fs.readFileSync(htmlPath, "utf8");
            res.setHeader("Content-Type", "text/html");
            res.end(html.replace("<title>VueVN Editor</title>", `<title>${title}</title>`));
          } catch (e) {
            res.statusCode = 500;
            res.end(`[vuevn] Failed to load dev index.html: ${e.message}`);
          }
          return;
        }
        return next();
      });
    },
    resolveId(id) {
      if (id === "/@vuevn/dev-main") {
        const pkgRoot = path.resolve(__dirname, "../..");
        return path.join(pkgRoot, "vite-dev", "main.ts");
      }
    },
  };
}

async function startDevServer({ projectRoot, config, noEditor = false }) {
  const vite = optional("vite", projectRoot);
  if (!vite) {
    throw new Error("Vite is not installed in the project. Run: npm i -D vite @vitejs/plugin-vue");
  }
  const vuePlugin = optional("@vitejs/plugin-vue", projectRoot);
  const vueDevtools = optional("vite-plugin-vue-devtools", projectRoot);

  const plugins = [];
  if (vuePlugin) plugins.push(vuePlugin());
  if (vueDevtools) plugins.push(vueDevtools());
  plugins.push(editorInjectionPlugin({ title: config.displayName || config.name || "VueVN Editor", enabled: !noEditor && config?.editor?.enabled !== false }));

  const cliRoot = path.resolve(__dirname, "../..");
  const server = await vite.createServer({
    root: projectRoot,
    plugins,
    resolve: {
      alias: {
        "@generate": path.join(projectRoot, "generate"),
        "@locations": path.join(projectRoot, "locations"),
        "@global": path.join(projectRoot, "global"),
        "@plugins": path.join(projectRoot, "plugins"),
        "@project": projectRoot,
        "@engine": path.join(cliRoot, "engine_src"),
        "@editor": path.join(cliRoot, "editor_src"),
        "@vuevn/engine_src": path.join(cliRoot, "engine_src"),
        "@vuevn/editor_src": path.join(cliRoot, "editor_src"),
      },
    },
    server: {
      host: true,
      port: 5173,
      strictPort: false,
      fs: { allow: [projectRoot, cliRoot] },
    },
  });

  await server.listen();
  const info = server.config.server;
  console.log(`[vuevn] Vite dev server running at: http://localhost:${info.port}`);

  // Setup text/config watchers to regenerate on change (hot reload)
  try {
    const { runGenerateTexts, runGenerate, runGenerateEngine, runGenerateProject } = require('../generate/index');
    const w = server.watcher;
    const toProj = (p) => path.join(projectRoot, p);
    const textGlobs = [
      toProj('global/texts/**/*.ts'),
      toProj('locations/**/texts/**/*.ts'),
    ];
    const cfgFile = toProj('config.ts');
    const watchRoots = [toProj('global'), toProj('locations'), toProj('plugins')];

    // Debounce helper
    let pending = null;
    function schedule(fn, delay = 80) {
      if (pending) clearTimeout(pending);
      pending = setTimeout(async () => {
        pending = null;
        try {
          await fn();
          server.ws.send({ type: 'full-reload' });
        } catch (e) {
          console.error('[vuevn] watcher error:', e && e.message ? e.message : e);
        }
      }, delay);
    }

    w.add(textGlobs);
    w.add(watchRoots);
    const onText = () => schedule(() => runGenerateTexts({ projectRoot, verbose: false }), 80);
    const isTextFile = (p) => p.endsWith('.ts') && p.includes(`${path.sep}texts${path.sep}`);
    const isCodeFile = (p) => /\.(ts|vue)$/i.test(p);
    const isUnderAny = (p, roots) => roots.some(r => p.startsWith(r + path.sep) || p === r);
    const onAny = (p) => {
      if (isTextFile(p)) return onText();
      if (!isCodeFile(p)) return;
      if (!isUnderAny(p, watchRoots)) return;
      // Split by area: plugins -> engine overlay; global/locations (non-text) -> project structure
      if (p.startsWith(toProj('plugins') + path.sep)) {
        return schedule(() => runGenerateEngine({ projectRoot, verbose: false }), 120);
      }
      if (p.startsWith(toProj('global') + path.sep) || p.startsWith(toProj('locations') + path.sep)) {
        return schedule(() => runGenerateProject({ projectRoot, verbose: false }), 120);
      }
    };
    w.on('add', onAny);
    w.on('change', onAny);
    w.on('unlink', onAny);

    // If config.ts changes, regenerate everything (languages/plugins may change)
    w.add(cfgFile);
    const onConfig = () => schedule(() => runGenerate({ projectRoot, verbose: false }), 150);
    w.on('change', (p) => { if (p === cfgFile) onConfig(); });
  } catch (e) {
    console.warn('[vuevn] Unable to initialize file watchers for texts/config:', e && e.message ? e.message : e);
  }
}

module.exports = { startDevServer };
