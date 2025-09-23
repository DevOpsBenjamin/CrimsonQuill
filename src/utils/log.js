export function pickIconset() {
  const pref = String(process.env.VUEVN_ICONSET ?? "nerd").toLowerCase();
  return pref === "ascii" ? "ascii" : "nerd";
}

export const nerd = {
  build: "",    // nf-fa-wrench
  gen: "",      // nf-oct-package
  note: "",     // nf-fa-pencil
  done: "",     // nf-fa-check
  verify: "",   // nf-fa-search
  error: "",    // nf-fa-times_circle
  gear: "",     // nf-fa-cogs
  add: "",      // nf-fa-plus
  override: "", // nf-fa-pencil (edit/override)
};

export const ascii = {
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

export const symbols = pickIconset() === "nerd" ? nerd : ascii;

// Optionnel : export par défaut pour plus de flexibilité
export default symbols;
