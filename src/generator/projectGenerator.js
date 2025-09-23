// ESM imports (built-in)
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { createTree } from './tree.js';
import { writeTsconfig } from './tsconfig.js'
import { writeEngine } from './engineTree.js'
import { symbols } from '../utils/log.js'
import { writeProjectData } from './projectTree.js'
import { writeTextsData } from './textTree.js'

export class ProjectGenerator {
  constructor(config = {}, verbose = false) {
    this.DEBUG = true;
    this.config = config;
    this.verbose = verbose;
    // __dirname equivalent en ESM
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    //src path for the generate step.
    this.node_path = resolve(__dirname, '..');
    this.project_path = process.cwd();
    this.generate_dir = join(this.project_path, 'generate');
  }

  async generateTree() {
    this.last_tree = createTree(this.node_path, this.project_path, this.config);

    if (this.DEBUG) {
      await writeFile(join(this.project_path, 'tree-debug.json'), JSON.stringify(this.last_tree, null, 2), 'utf8');
    }
  }

  async run() {
    console.log(`${symbols.build}  Building project: ${this.config.name}`);
    await this.generateTree();

    // STEP 1 CLEAN + tsconfig
    await writeTsconfig(this);
    // STEP 2 ENGINE
    await writeEngine(this);
    // STEP 3 Project
    await writeProjectData(this);
    // STEP 4 Texts 
    await writeTextsData(this);
  }
}
