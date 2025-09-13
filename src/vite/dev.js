"use strict";

const path = require("path");
const { createRequire } = require("module");
const fs = require("fs");

function optional(mod, projectRoot) {
  // Prefer resolving from the CLI package; fallback to the project
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
      if (id === "/@vuevn/dev-entry") {
        const pkgRoot = path.resolve(__dirname, "../..");
        return path.join(pkgRoot, "vite-dev", "entry.ts");
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
}

module.exports = { startDevServer };
