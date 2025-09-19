"use strict";

function pickIconset() {
  const pref = String(process.env.VUEVN_ICONSET || "nerd").toLowerCase();
  if (pref === "ascii") return "ascii";
  // default and any other value → nerd
  return "nerd";
}

const nerd = {
  // Nerd Font (Font Awesome / Octicons)
  build: "",   // nf-fa-wrench
  gen: "",     // nf-oct-package
  note: "",    // nf-fa-pencil
  done: "",    // nf-fa-check
  verify: "",  // nf-fa-search
  error: "",   // nf-fa-times_circle
  gear: "",    // nf-fa-cogs
  add: "",     // nf-fa-plus
  override: "",// nf-fa-pencil (edit/override)
};

const ascii = {
  build: "[BUILD]",
  gen: "[GEN]",
  note: "[NOTE]",
  done: "[OK]",
  verify: "[VERIFY]",
  error: "[ERROR]",
  gear: "[VERBOSE]",
  add: "[ADD]",
  override: "[OVERRIDE]",
};

const set = pickIconset();
const symbols = set === "nerd" ? nerd : ascii;

module.exports = { symbols };
