#!/usr/bin/env node
"use strict";

const { parseArgs } = require("../src/utils/parseArgs");

const commands = {
  help: require("../src/commands/help"),
  dev: require("../src/commands/dev"),
  build: require("../src/commands/build"),
  verify: require("../src/commands/verify"),
  create: require("../src/commands/create"),
  version: require("../src/commands/version"),
};

function main() {
  const argv = process.argv.slice(2);
  const { cmd, args, flags } = parseArgs(argv);

  const command = cmd || (flags.version ? "version" : null) || "help";

  if (!commands[command]) {
    console.error(`Unknown command: ${command}`);
    return commands.help({ args, flags });
  }

  return Promise.resolve(commands[command]({ args, flags }))
    .catch((err) => {
      console.error("\n[cq] Error:", err && err.stack ? err.stack : err);
      process.exitCode = 1;
    });
}

main();

