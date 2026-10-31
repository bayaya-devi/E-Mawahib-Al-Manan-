export type AppearanceMode = "light" | "dark" | "system";
export type AppearanceAccent = "mawahib" | "ocean" | "forest" | "night" | "pastel" | "green" | "blue" | "plum" | "gold";
type LegacyAppearanceAccent = "green" | "blue" | "plum" | "gold";

export function readAppearance(): AppearanceMode { if (typeof window === "undefined") return "system"; return (localStorage.getItem("emawahib.appearance") as AppearanceMode | null) ?? "system"; }
export function readAccent(): AppearanceAccent {
  if (typeof window === "undefined") return "mawahib";
  const saved = localStorage.getItem("emawahib.accent") as AppearanceAccent | LegacyAppearanceAccent | null;
  return normalizeAccent(saved);
}
export function saveAppearance(mode: AppearanceMode, accent: AppearanceAccent | LegacyAppearanceAccent) { const normalized = normalizeAccent(accent); localStorage.setItem("emawahib.appearance", mode); localStorage.setItem("emawahib.accent", normalized); applyAppearance(mode, normalized); }
export function applyAppearance(mode = readAppearance(), accent: AppearanceAccent | LegacyAppearanceAccent = readAccent()) { const prefersDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches; const dark = mode === "dark" || (mode === "system" && prefersDark); document.documentElement.dataset.appearance = dark ? "dark" : "light"; document.documentElement.dataset.accent = normalizeAccent(accent); }
export function watchSystemAppearance(): () => void { if (typeof matchMedia !== "function") return () => undefined; const query = matchMedia("(prefers-color-scheme: dark)"); const update = () => { if (readAppearance() === "system") applyAppearance("system", readAccent()); }; query.addEventListener("change", update); return () => query.removeEventListener("change", update); }

function normalizeAccent(value: AppearanceAccent | LegacyAppearanceAccent | null): Exclude<AppearanceAccent, LegacyAppearanceAccent> {
  const legacy = { green: "forest", blue: "ocean", plum: "night", gold: "mawahib" } as const;
  if (value && value in legacy) return legacy[value as LegacyAppearanceAccent];
  return value && ["mawahib", "ocean", "forest", "night", "pastel"].includes(value) ? value as Exclude<AppearanceAccent, LegacyAppearanceAccent> : "mawahib";
}
