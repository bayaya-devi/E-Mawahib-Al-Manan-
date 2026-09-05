export type AppearanceMode = "light" | "dark" | "system";
export type AppearanceAccent = "green" | "blue" | "plum" | "gold";

export function readAppearance(): AppearanceMode { if (typeof window === "undefined") return "system"; return (localStorage.getItem("emawahib.appearance") as AppearanceMode | null) ?? "system"; }
export function readAccent(): AppearanceAccent { if (typeof window === "undefined") return "green"; return (localStorage.getItem("emawahib.accent") as AppearanceAccent | null) ?? "green"; }
export function saveAppearance(mode: AppearanceMode, accent: AppearanceAccent) { localStorage.setItem("emawahib.appearance", mode); localStorage.setItem("emawahib.accent", accent); applyAppearance(mode, accent); }
export function applyAppearance(mode = readAppearance(), accent = readAccent()) { const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches); document.documentElement.dataset.appearance = dark ? "dark" : "light"; document.documentElement.dataset.accent = accent; }
