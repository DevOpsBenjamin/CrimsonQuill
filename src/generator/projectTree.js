// projectTree.js (ESM)
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { symbols } from '../utils/log.js';
import { writeLocationKind, writeGlobalKind } from '../utils/projectKind.js';

const PROJECT_KINDS = ['actions', 'events'];

async function writeLocalIndex({ label, outDir, dirs }) {
  await mkdir(outDir, { recursive: true });

  const importLines = dirs.map((name, idx) => `import d${idx} from './${name}/index.js';`);
  const subLines = dirs.map((name, idx) => `    "${name}": d${idx}`);
  const subBlock = subLines.length
    ? `  sub: {\n${subLines.join(',\n')}\n  }`
    : '  sub: {}';

  const content = `// Generated index for: ${label}
${importLines.join('\n')}

export const list = {
${subBlock}
} as const;

export default list;
`;

  await writeFile(join(outDir, 'index.ts'), content, 'utf8');
}

// --- writeEngine minuscule : orchestre seulement ---
export async function writeProjectData(gen) {
  console.log(`${symbols.build}  Generate projet ...`);

  const locationsRoot = gen.last_tree.locations?.dirs || {};
  const locationIds = Object.keys(locationsRoot).sort();
  const exportedLocations = [];

  for (const id of locationIds) {
    const locNode = locationsRoot[id];
    const availableKinds = PROJECT_KINDS.filter(kind => locNode?.dirs?.[kind]);

    if (!availableKinds.length) {
      continue;
    }

    exportedLocations.push(id);

    for (const kind of availableKinds) {
      await writeLocationKind(gen, id, kind);
    }

    await writeLocalIndex({
      label: `project/locations/${id}`,
      outDir: join(gen.generate_dir, 'project', 'locations', id),
      dirs: availableKinds,
    });
  }

  const availableGlobalKinds = PROJECT_KINDS.filter(kind => gen.last_tree.global?.dirs?.[kind]);
  for (const kind of availableGlobalKinds) {
    await writeGlobalKind(gen, kind);
  }

  await writeLocalIndex({
    label: 'project/global',
    outDir: join(gen.generate_dir, 'project', 'global'),
    dirs: availableGlobalKinds,
  });

  await writeLocalIndex({
    label: 'project/locations',
    outDir: join(gen.generate_dir, 'project', 'locations'),
    dirs: exportedLocations,
  });

  await writeLocalIndex({
    label: 'project',
    outDir: join(gen.generate_dir, 'project'),
    dirs: ['global', 'locations'],
  });
}
