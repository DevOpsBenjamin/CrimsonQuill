"use strict";

module.exports = function help() {
  const lines = [
    "VueVN CLI (WIP)",
    "",
    "Usage:",
    "  vuevn <command> [options]",
    "",
    "Commands:",
    "  dev       Start editor dev server (in current folder)",
    "  build     Build production game to ./dist",
    "  verify    Run validations (typecheck/lint)",
    "  create    Scaffold a new project in a subfolder",
    "  version   Show CLI version",
    "  help      Show this help",
    "",
    "Common options:",
    "  --ignore-translations, -i       Skip i18n checks",
    "  --verbose, -v                   Verbose output",
    "",
    "create options:",
    "  vuevn create <dir> [--template basic] [--yes|--force] [--display-name 'My Game']",
    "",
    "Notes:",
    "  - dev/build/verify always use the current working directory.",
    "  - A valid VueVN project requires a package.json with a 'vuevn' field.",
  ];
  console.log(lines.join("\n"));
};
