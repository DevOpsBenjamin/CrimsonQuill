// ESM imports (built-in)
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createTree } from './tree.js';
import { symbols } from '../utils/log.js'

export class ProjectGenerator {
  constructor(config = {}, verbose = false) {
    this.config = config;
    this.verbose = verbose;
    // __dirname equivalent en ESM
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    //src path for the generate step.
    this.node_path = resolve(__dirname, '..');
    this.project_path = process.cwd();
  }
  async run() {
    console.log(`${symbols.build}  Building project: ${this.config.name}`);

    const trees = createTree(this.node_path, this.project_path, this.config);
    // Écrit le JSON brut dans ./tree-debug
    await writeFile(join(this.project_path, 'tree-debug.json'), JSON.stringify(trees, null, 2), 'utf8');
  }
}
