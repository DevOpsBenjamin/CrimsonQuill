"use strict";

const fs = require("fs");
const path = require("path");
const { copyDir } = require("../utils/fs");
const { spawn } = require("child_process");

function isEmptyDir(dir) {
  return !fs.existsSync(dir) || fs.readdirSync(dir).length === 0;
}

function promptYesNo(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setEncoding("utf8");
    const onData = (data) => {
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      const v = String(data || "").trim().toLowerCase();
      resolve(v === "y" || v === "yes");
    };
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

function promptInput(question, defaultValue) {
  return new Promise((resolve) => {
    process.stdout.write(`${question}${defaultValue ? ` (${defaultValue})` : ""}: `);
    process.stdin.setEncoding("utf8");
    const onData = (data) => {
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      const v = String(data || "").trim();
      resolve(v || defaultValue || "");
    };
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

function toKebabCase(str) {
  return String(str)
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function toTitle(str) {
  return String(str)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

module.exports = async function create({ args, flags }) {
  let targetArg = args[0];
  const template = flags.template || "basic";
  const force = !!(flags.force || flags.yes || flags.y);
  let displayName = flags["display-name"]; 

  if (!targetArg) {
    const suggested = toKebabCase("my-vuevn-game");
    const answer = force ? suggested : await promptInput("Project folder name", suggested);
    targetArg = toKebabCase(answer || suggested) || suggested;
  }

  const targetDir = path.resolve(process.cwd(), targetArg);
  const projectName = toKebabCase(targetArg === "." ? path.basename(targetDir) : path.basename(targetArg));

  if (!displayName) {
    const suggestedTitle = toTitle(projectName || "My VueVN Game");
    displayName = force ? suggestedTitle : await promptInput("Display name", suggestedTitle);
  }

  if (!isEmptyDir(targetDir)) {
    if (!force) {
      const ok = await promptYesNo(`[vuevn] Directory '${targetArg}' is not empty. Continue and overwrite files? [y/N] `);
      if (!ok) {
        console.log("[vuevn] Aborted.");
        return;
      }
    }
  } else {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const tplDir = path.resolve(__dirname, "../../templates", template);
  console.log(`[vuevn] Creating project '${projectName}' in '${targetArg}' from template '${template}'`);
  copyDir(tplDir, targetDir);

  // Patch vuevn.config.ts name if present
  const cfgPath = path.join(targetDir, "vuevn.config.ts");
  if (fs.existsSync(cfgPath)) {
    const content = fs.readFileSync(cfgPath, "utf8");
    const patched = content
      .replace(/name:\s*"[^"]+"/, `name: "${projectName}"`)
      .replace(/displayName:\s*"[^"]+"/, `displayName: "${displayName}"`);
    fs.writeFileSync(cfgPath, patched, "utf8");
  }

  // Patch package.json if present
  const pkgPath = path.join(targetDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      pkg.name = projectName || pkg.name;
      pkg.displayName = displayName || pkg.displayName;
      pkg.private = true;
      pkg.version = pkg.version || "0.0.0";
      pkg.type = pkg.type || "module";
      pkg.scripts = Object.assign(
        {
          dev: "vuevn dev",
          build: "vuevn build",
          verify: "vuevn verify",
        },
        pkg.scripts || {}
      );
      // Ensure minimal deps for dev server to work out of the box
      pkg.dependencies = Object.assign({ vue: "^3.4.0" }, pkg.dependencies || {});
      pkg.devDependencies = Object.assign({
        vite: "^5.0.0",
        "@vitejs/plugin-vue": "^5.0.0",
      }, pkg.devDependencies || {});
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    } catch (e) {
      console.warn("[vuevn] Warning: could not patch package.json:", e.message);
    }
  }

  // Patch HTML title if present
  const htmlPath = path.join(targetDir, "game.html");
  if (fs.existsSync(htmlPath)) {
    try {
      const html = fs.readFileSync(htmlPath, "utf8");
      const updated = html.replace(/<title>[^<]*<\/title>/i, `<title>${displayName}</title>`);
      fs.writeFileSync(htmlPath, updated, "utf8");
    } catch (e) {
      console.warn("[vuevn] Warning: could not patch HTML title:", e.message);
    }
  }

  console.log("[vuevn] Project created at:", targetDir);
  console.log("[vuevn] Next steps:");
  if (targetArg !== ".") console.log(`  cd ${targetArg}`);
  console.log("  npm install");
  console.log("  npm run dev   # start editor (dev)");
  console.log("  npm run build # build game (prod)");
};
