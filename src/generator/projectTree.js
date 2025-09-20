// projectTree.js (ESM)
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { symbols } from '../utils/log.js';
import { writeRecursiveIndex } from '../utils/tree.js';

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

async function writeProjectRootIndex(gen) {
  const projectDir = join(gen.generate_dir, 'project');
  const entries = ['global', 'locations'];
  await writeLocalIndex({ label: 'project', outDir: projectDir, dirs: entries });
}

async function writeLocationsIndex(gen) {
  await writeRecursiveIndex({
    node: gen.last_tree.locations,
    outDir: join(gen.generate_dir, 'project', 'locations'),
    sourceAlias: '@locations',
    importBase: '',
  });
}

async function writeGlobalIndex(gen) {
  await writeRecursiveIndex({
    node: gen.last_tree.global,
    outDir: join(gen.generate_dir, 'project', 'global'),
    sourceAlias: '@global',
    importBase: '',
  });
}

// --- writeEngine minuscule : orchestre seulement ---
export async function writeProjectData(gen) {
  console.log(`${symbols.build}  Generate projet ...`);

  await writeGlobalIndex(gen);
  await writeLocationsIndex(gen);
  await writeProjectRootIndex(gen);
}
