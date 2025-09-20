// projectKinds.js (ESM)
import { join } from 'node:path';
import { writeRecursiveIndex } from './tree.js';

export async function writeLocationKind(gen, locId, kind /* 'actions' | 'events' */) {
  const locRoot = gen.last_tree?.locations;
  const node = locRoot?.dirs?.[locId]?.dirs?.[kind];
  if (!node) return;

  await writeRecursiveIndex({
    node,
    outDir: join(gen.generate_dir, 'project', 'locations', locId, kind),
    sourceAlias: '@locations',
    importBase: `${locId}/${kind}`,
  });
}

export async function writeGlobalKind(gen, kind /* 'actions' | 'events' */) {
  const node = gen.last_tree?.global?.dirs?.[kind];
  if (!node) return;

  await writeRecursiveIndex({
    node,
    outDir: join(gen.generate_dir, 'project', 'global', kind),
    sourceAlias: '@global',
    importBase: `${kind}`,
  });
}
