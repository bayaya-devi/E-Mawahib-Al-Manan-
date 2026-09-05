export type AppearanceMode = "light" | "dark" | "system";
export type AppearanceAccent = "green" | "blue" | "plum" | "gold";

export function readAppearance(): AppearanceMode { if (typeof window === "undefined") return "system"; return (localStorage.getItem("emawahib.appearance") as AppearanceMode | null) ?? "system"; }
export function readAccent(): AppearanceAccent { if (typeof window === "undefined") return "green"; return (localStorage.getItem("emawahib.accent") as AppearanceAccent | null) ?? "green"; }
export function saveAppearance(mode: AppearanceMode, accent: AppearanceAccent) { localStorage.setItem("emawahib.appearance", mode); localStorage.setItem("emawahib.accent", accent); applyAppearance(mode, accent); }
export function applyAppearance(mode = readAppearance(), accent = readAccent()) { const prefersDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches; const dark = mode === "dark" || (mode === "system" && prefersDark); document.documentElement.dataset.appearance = dark ? "dark" : "light"; document.documentElement.dataset.accent = accent; }
export function watchSystemAppearance(): () => void { if (typeof matchMedia !== "function") return () => undefined; const query = matchMedia("(prefers-color-scheme: dark)"); const update = () => { if (readAppearance() === "system") applyAppearance("system", readAccent()); }; query.addEventListener("change", update); return () => query.removeEventListener("change", update); }
