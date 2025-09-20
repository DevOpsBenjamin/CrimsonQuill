"use strict";

const flagAliases = {
  p: "project",
  o: "out-dir",
  v: "verbose",
  V: "version",
  i: "ignore-translations",
};

function parseArgs(argv) {
  const flags = {};
  const args = [];
  let cmd = null;

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!cmd && !token.startsWith("-")) {
      cmd = token;
      continue;
    }

    if (token.startsWith("--")) {
      const [k, v] = token.slice(2).split("=");
      const key = k;
      if (typeof v !== "undefined") flags[key] = v;
      else if (i + 1 < argv.length && !argv[i + 1].startsWith("-")) flags[key] = argv[++i];
      else flags[key] = true;
      continue;
    }

    if (token.startsWith("-")) {
      const letters = token.slice(1).split("");
      for (let j = 0; j < letters.length; j++) {
        const alias = letters[j];
        const key = flagAliases[alias] || alias;
        if (j === letters.length - 1 && i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
          flags[key] = argv[++i];
        } else {
          flags[key] = true;
        }
      }
      continue;
    }

    args.push(token);
  }

  return { cmd, args, flags };
}

module.exports = { parseArgs };

