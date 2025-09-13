"use strict";

module.exports = function help() {
  const lines = [
    "VueVN CLI (WIP)",
    "",
    "Usage:",
    "  vuevn <command> [options]",
    "",
    "Commands:",
    "  dev       Start editor dev server",
    "  build     Build production game",
    "  verify    Run validations (typecheck/lint)",
    "  create    Scaffold a new project",
    "  version   Show CLI version",
    "  help      Show this help",
    "",
    "Common options:",
    "  --project, -p <path>            Project root (default: .)",
    "  --ignore-translations, -i       Skip i18n checks",
    "  --verbose, -v                   Verbose output",
    "",
    "create options:",
    "  vuevn create <dir|.> [--template basic] [--yes|--force] [--display-name 'My Game']",
  ];
  console.log(lines.join("\n"));
};
