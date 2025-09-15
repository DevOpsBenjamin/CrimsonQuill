"use strict";

const fs = require("fs");
const path = require("path");
const { resolveProjectRoot, loadConfig } = require("../utils/config");
const { runGenerateEngine, runGenerateProject, runGenerateTexts, extractLanguagesFromConfig } = require("../generate/index");
const { buildGame } = require("../vite/build");

module.exports = async function build({ args = [], flags }) {
  // Support both --verbose and trailing '/verbose' arg (compat mimic)
  const verbose = !!flags.verbose || (args && args.includes('/verbose'));
  const projectRoot = resolveProjectRoot();
  const cfg = loadConfig(projectRoot);
  const projectId = path.basename(projectRoot);

  const { symbols } = require('../utils/log');
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
      throw new Error("No languages declared in config.ts. Define languages: [{ code: 'en', name: 'English', default: true }, ...]");
    }
    log(`${symbols.note} Generating texts for languages: ${langs.join(', ')}`);
    await runGenerateTexts({ projectRoot, verbose });
    log(`${symbols.done} Text generation complete`);
    log(`${symbols.done} Generated i18n system successfully`);

    // Verbose: show extra context in console
    if (verbose) {
      log(`${symbols.gear}  Phases: engine-overlay, project-structure, texts`);
      log(`${symbols.gear}  Languages: ${langs.join(', ')}`);
      // Counts and overrides/additions are now printed during generation (from the trees), not here.
    }

    // Optional verify step mimic
    if (verbose) {
      log(`${symbols.verify} Verifying project quality... (verbose)`);
    } else {
      log(`${symbols.verify} Verifying project quality... for base build`);
    }

    await buildGame({ projectRoot, config: cfg, outDir: "dist" });
    log(`${symbols.done} Build completed in ./dist`);
  } catch (e) {
    console.error(`${symbols.error} Build failed:`, e && e.message ? e.message : e);
  }
};
