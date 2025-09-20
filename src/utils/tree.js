// utils/tree.js (ESM) — TS UNIQUEMENT
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const isTS = (ext) => (ext || '').toLowerCase() === '.ts';
const listDirs = (node) => node?.dirs ? Object.keys(node.dirs) : [];
const listFiles = (node) => Array.isArray(node?.files) ? node.files : [];
const joinImportPath = (...segments) => segments.filter(Boolean).join('/');

async function writeTextFile(dir, name, content) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), content, 'utf8');
}

/**
 * Écrit un index.ts par dossier (récursif).
 * - Fichiers TS uniquement
 * - list = { <fileName>: module, <subdir>: defaultExportDeSubdir }
 * @param {object} opts
 *  - node        : nœud d’arbre pour CE dossier
 *  - outDir      : dossier de sortie (dans generate/…)
 *  - sourceAlias : '@global' | '@locations'
 *  - importBase  : chemin après l’alias pour CE dossier (ex: 'actions', 'bedroom/events', 'texts')
 */
export async function writeRecursiveIndex({ node, outDir, sourceAlias, importBase }) {
  if (!node) return;

  // 1) sous-dossiers d'abord
  const subdirs = listDirs(node).sort();
  for (const sub of subdirs) {
    await writeRecursiveIndex({
      node: node.dirs[sub],
      outDir: join(outDir, sub),
      sourceAlias,
      importBase: importBase ? `${importBase}/${sub}` : sub,
    });
  }

  // 2) fichiers TS du dossier courant
  const files = listFiles(node)
    .filter(f => isTS(f.ext))
    .sort((a, b) => a.name.localeCompare(b.name));

  const importLines = [];
  const listLines = [];

  // a) fichiers
  files.forEach((f, i) => {
    const v = `f${i}`;
    const rel = f.name; // sans extension
    const importPath = joinImportPath(sourceAlias, importBase, rel);
    importLines.push(`import ${v} from '${importPath}';`);
    listLines.push(`  "${rel}": ${v}`);
  });

  // b) sous-dossiers (⚠️ ESM → ./sub/index.js)
  subdirs.forEach((sub, i) => {
    const id = `d${i}`;
    importLines.push(`import ${id} from './${sub}/index.js';`);
    listLines.push(`  "${sub}": ${id}`);
  });

  const target = importBase || '.';
  const content =
    `// Generated index for: ${target}
${importLines.join('\n')}

export const list = {
${listLines.join(',\n')}
} as const;

export default list;
`;

  await writeTextFile(outDir, 'index.ts', content);
}
