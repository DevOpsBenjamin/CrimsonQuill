// src/commands/build.js (ESM)
import path from 'node:path';
import { resolveProjectRoot, loadConfig } from '../utils/config.js';
import {
  runGenerateEngine,
  runGenerateProject,
  runGenerateTexts,
  extractLanguagesFromConfig
} from '../generate/index.js';
import { runVerify } from '../verify.js';            // adapte ce chemin si ton fichier est ailleurs
import { buildGame } from '../vite/build.js';
import { symbols } from '../utils/log.js';

export default async function build({ args = [], flags = {} }) {
  const verbose = !!flags.verbose || (args && args.includes('/verbose'));
  const ignoreTranslations = !!flags['ignore-translations'] || (args && args.includes('/ignore-translations'));

  const projectRoot = resolveProjectRoot();
  const cfg = loadConfig(projectRoot);
  const projectId = path.basename(projectRoot);

  const log = (msg) => console.log(msg);
  log(`${symbols.build}  Building project: ${projectId}`);
  log(`${symbols.gen} Generating project files...`);
  if (verbose) log(`${symbols.gear}  Verbose mode enabled`);

  try {
    // Phase 1: engine overlay (plugins + engine)
    await runGenerateEngine({ projectRoot, verbose });

    // Phase 2: project structure (global/locations)
    await runGenerateProject({ projectRoot, verbose });

    // Phase 3: texts (list languages from config)
    const langs = extractLanguagesFromConfig(projectRoot);
    if (!langs || langs.length === 0) {
      throw new Error(
        "No languages declared in config.ts. Define languages: [{ code: 'en', name: 'English', default: true }, ...]"
      );
    }
    log(`${symbols.note} Generating texts for languages: ${langs.join(', ')}`);
    await runGenerateTexts({ projectRoot, verbose });
    log(`${symbols.done} Text generation complete`);
    log(`${symbols.done} Generated i18n system successfully`);

    if (verbose) {
      log(`${symbols.gear}  Phases: engine-overlay, project-structure, texts`);
      log(`${symbols.gear}  Languages: ${langs.join(', ')}`);
    }

    // Verify (TS + i18n)
    log(`${symbols.verify} Verifying project quality...${verbose ? ' (verbose)' : ''}`);
    await runVerify({ projectRoot, ignoreTranslations, verbose, ensureGenerate: false });

    await buildGame({ projectRoot, config: cfg, outDir: 'dist' });
    log(`${symbols.done} Build completed in ./dist`);
  } catch (e) {
    console.error(`${symbols.error} Build failed:`, e?.message || e);
    throw e; // remonte l’erreur au binaire (qui fixera exitCode)
  }
}
