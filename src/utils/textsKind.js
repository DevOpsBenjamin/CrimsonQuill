// textsKinds.js (ESM)
import { join } from 'node:path';
import { writeRecursiveIndex } from './tree.js';

// global/texts/**  -> generate/texts/global/**
export async function writeGlobalTexts(gen) {
  const node = gen.last_tree?.global?.dirs?.texts;
  if (!node) return;

  await writeRecursiveIndex({
    node,
    outDir: join(gen.generate_dir, 'texts', 'global'),
    sourceAlias: '@global',
    importBase: 'texts',
  });
}

// locations/<loc>/texts/** -> generate/texts/locations/<loc>/**
export async function writeLocationTexts(gen, locId) {
  const node = gen.last_tree?.locations?.dirs?.[locId]?.dirs?.texts;
  if (!node) return;

  await writeRecursiveIndex({
    node,
    outDir: join(gen.generate_dir, 'texts', 'locations', locId),
    sourceAlias: '@locations',
    importBase: `${locId}/texts`,
  });
}
