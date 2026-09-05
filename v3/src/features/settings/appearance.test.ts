// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { readAccent, readAppearance, saveAppearance, watchSystemAppearance } from "./appearance";

afterEach(() => { localStorage.clear(); document.documentElement.removeAttribute("data-appearance"); document.documentElement.removeAttribute("data-accent"); vi.unstubAllGlobals(); });

it("applies and persists the selected mode and accent", () => {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  saveAppearance("dark", "plum");
  expect(readAppearance()).toBe("dark"); expect(readAccent()).toBe("plum");
  expect(document.documentElement.dataset.appearance).toBe("dark"); expect(document.documentElement.dataset.accent).toBe("plum");
});

it("tracks the operating-system mode while system is selected", () => {
  let listener: (() => void) | undefined; const query = { matches: false, addEventListener: (_: string, value: () => void) => { listener = value; }, removeEventListener: vi.fn() };
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(query)); saveAppearance("system", "green"); expect(document.documentElement.dataset.appearance).toBe("light");
  const stop = watchSystemAppearance(); query.matches = true; listener?.(); expect(document.documentElement.dataset.appearance).toBe("dark"); stop();
});
