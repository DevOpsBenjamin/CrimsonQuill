"use strict";

const path = require("path");
const { createRequire } = require("module");

function optional(mod, projectRoot) {
  // Prefer resolving from the project to pick up its devDeps
  try {
    const req = createRequire(path.join(projectRoot, "package.json"));
    return req(mod);
  } catch {}
  try { return require(mod); } catch { return null; }
}

function editorInjectionPlugin({ title = "VueVN Editor", enabled = true } = {}) {
  return {
    name: "vuevn-editor-injection",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!enabled) return next();
        if (req.url === "/" || req.url === "/index.html") {
          const html = `<!doctype html>
  <html>
    <head>
      <meta charset=\"utf-8\" />
      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
      <title>${title}</title>
    </head>
    <body>
      <div id=\"app\"></div>
      <script type=\"module\" src=\"/@vuevn/editor-entry.js\"></script>
    </body>
  </html>`;
          res.setHeader("Content-Type", "text/html");
          res.end(html);
          return;
        }
        return next();
      });
    },
    resolveId(id) {
      if (id === "/@vuevn/editor-entry.js") return id;
    },
    load(id) {
      if (id === "/@vuevn/editor-entry.js") {
        return `
          import { mountEditor } from '@editor';
          mountEditor();
          (async () => {
            try {
              await import('@runtime/main.ts');
              console.log('[vuevn] runtime loaded');
            } catch (e) {
              console.warn('[vuevn] no runtime found at @runtime/main.ts');
            }
          })();
        `;
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
        "@locations": path.join(projectRoot, "locations"),
        "@global": path.join(projectRoot, "global"),
        "@plugins": path.join(projectRoot, "plugins"),
        "@generate": path.join(projectRoot, "generate"),
        "@project": projectRoot,
        "@runtime": path.join(projectRoot, "runtime"),
        "@engine": path.join(cliRoot, "engine_src"),
        "@editor": path.join(cliRoot, "editor_src"),
      },
    },
    server: {
      host: true,
      port: 5173,
      strictPort: false,
    },
  });

  await server.listen();
  const info = server.config.server;
  console.log(`[vuevn] Vite dev server running at: http://localhost:${info.port}`);
}

module.exports = { startDevServer };
