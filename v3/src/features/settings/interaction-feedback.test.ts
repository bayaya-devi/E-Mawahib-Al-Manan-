// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { emitLearningFeedback, readFeedbackPreferences, saveFeedbackPreferences, setQuranRecitationActive } from "./interaction-feedback";

afterEach(() => { localStorage.clear(); document.documentElement.removeAttribute("data-quran-playing"); vi.unstubAllGlobals(); });

it("persists application sound and vibration preferences", () => {
  saveFeedbackPreferences({ sounds: false, vibrations: false });
  expect(readFeedbackPreferences()).toEqual({ sounds: false, vibrations: false });
});

it("uses haptics when supported and never throws when sound is unavailable", () => {
  const vibrate = vi.fn(); vi.stubGlobal("navigator", { vibrate });
  expect(() => emitLearningFeedback("error")).not.toThrow(); expect(vibrate).toHaveBeenCalledWith([45, 35, 45]);
});

it("suppresses UI sounds while Quran recitation is active", () => {
  const AudioContext = vi.fn(); vi.stubGlobal("AudioContext", AudioContext); vi.stubGlobal("navigator", { vibrate: vi.fn() });
  setQuranRecitationActive(true); emitLearningFeedback("correct"); expect(AudioContext).not.toHaveBeenCalled();
});
