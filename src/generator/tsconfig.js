// tsconfig.js (ESM)
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';


const toPosix = (p) => p.replace(/\\/g, '/');

export async function writeTsconfig(gen) {
  const destDir = gen.generate_dir;
  // 1) Clean hard, then recreate
  await rm(destDir, { recursive: true, force: true });
  await mkdir(destDir, { recursive: true });

  // bases réelles
  const engineDir = join(gen.node_path, 'engine');
  const projectPluginsDir = join(gen.project_path, 'plugins');
  const projectGlobalDir = join(gen.project_path, 'global');
  const projectLocationsDir = join(gen.project_path, 'locations');

  // chemins relatifs depuis generate/
  const rel = (abs) => toPosix(relative(destDir, abs));

  // alias de base
  const paths = {
    '@engine/*': [`${rel(engineDir)}/*`],
    '@project/*': [`${rel(projectPluginsDir)}/*`],
    '@global/*': [`${rel(projectGlobalDir)}/*`],
    '@locations/*': [`${rel(projectLocationsDir)}/*`],
  };

  // alias plugins (nom pur)
  const pluginNames = Array.isArray(gen?.config?.plugins) ? gen.config.plugins : [];
  for (const name of pluginNames) {
    const plugSrc = join(gen.project_path, 'node_modules', name, 'src');
    paths[`@plugins/${name}/*`] = [`${rel(plugSrc)}/*`];
  }

  const tsconfig = {
    compilerOptions: {
      baseUrl: '.',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      target: 'ES2022',
      strict: true,
      allowJs: true,
      resolveJsonModule: true,
      skipLibCheck: true,
      noEmit: true,             // type-check only
      paths
    },
    include: ['**/*.ts']        // uniquement les proxies générés
  };

  await writeFile(join(destDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2), 'utf8');
}
