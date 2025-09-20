// src/utils/config.js
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build as esbuild } from 'esbuild';

export async function loadConfig(projectRoot = process.cwd()) {
  const root = path.resolve(projectRoot);
  const tsFile = path.join(root, 'config.ts');
  if (!fs.existsSync(tsFile) || !fs.statSync(tsFile).isFile()) {
    throw new Error(`Missing config.ts at project root: ${tsFile}`);
  }

  // Transpile TS -> ESM temporaire
  const tmp = path.join(
    os.tmpdir(),
    `cq-config-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`
  );

  await esbuild({
    entryPoints: [tsFile],
    outfile: tmp,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    bundle: false,           // OK car on n'autorise que des `import type`
    sourcemap: 'inline',
    logLevel: 'silent',
    loader: { '.ts': 'ts' }
  });

  try {
    // Cache-bust pour contourner le cache ESM de Node
    const url = pathToFileURL(tmp).href + `?t=${Date.now()}`;
    const mod = await import(url);

    let cfg = mod?.default;
    if (typeof cfg === 'function') cfg = await cfg();

    if (!cfg || typeof cfg !== 'object') {
      throw new Error('config.ts must export default an object or a function returning an object.');
    }
    if (typeof cfg.name !== 'string' || !cfg.name.trim()) {
      throw new Error('config.name (string) is required.');
    }
    return cfg;
  } finally {
    // best-effort cleanup
    fsp.unlink(tmp).catch(() => { });
  }
}

