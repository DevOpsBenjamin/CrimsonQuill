"use strict";

const { verifyTypes } = require("./typescript");
const { verifyI18n } = require("./i18n");
const { runGenerate } = require("../generate/index");
const { symbols } = require("../utils/log");

async function runVerify({ projectRoot, ignoreTranslations = false, verbose = false, ensureGenerate = true }) {
  const log = (msg) => console.log(msg);
  if (ensureGenerate) {
    try {
      await runGenerate({ projectRoot, verbose });
    } catch (e) {
      throw new Error(`Failed to generate before verify: ${e && e.message ? e.message : e}`);
    }
  }

  // 1) TypeScript typecheck
  try {
    if (verbose) log(`${symbols.verify} TypeScript typecheck...`);
    await verifyTypes({ projectRoot, verbose });
    if (verbose) log(`${symbols.done} TypeScript OK`);
  } catch (e) {
    throw new Error(`TypeScript errors found. ${verbose ? '' : 'Run with --verbose for details.'}`);
  }

  // 2) i18n keys completeness
  const i18n = await verifyI18n({ projectRoot, ignoreTranslations, verbose });
  if (!i18n.success) {
    if (ignoreTranslations) {
      log(`${symbols.note} i18n issues ignored (/ignore-translations): ${i18n.count}`);
    } else {
      throw new Error(`i18n: missing ${i18n.count} key(s). Add /ignore-translations to bypass.`);
    }
  } else {
    if (i18n.ignored) log(`${symbols.note} i18n issues ignored`);
    else if (verbose) log(`${symbols.done} i18n OK`);
  }

  return { success: true };
}

module.exports = { runVerify };
