export type FeedbackPreferences = { sounds: boolean; vibrations: boolean };
const KEY = "emawahib.feedback.v1";
const defaults: FeedbackPreferences = { sounds: true, vibrations: true };
let sharedAudioContext: AudioContext | null = null;

export function readFeedbackPreferences(): FeedbackPreferences {
  if (typeof window === "undefined") return defaults;
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return defaults; }
}
export function saveFeedbackPreferences(value: FeedbackPreferences): void {
  localStorage.setItem(KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("emawahib:feedback-preferences", { detail: value }));
}
export function setQuranRecitationActive(active: boolean): void {
  if (typeof document !== "undefined") document.documentElement.dataset.quranPlaying = active ? "true" : "false";
}
export function primeLearningFeedback(): void {
  if (typeof window === "undefined" || !readFeedbackPreferences().sounds) return;
  const context = getAudioContext();
  if (context?.state === "suspended") void context.resume().catch(() => undefined);
}
export function emitLearningFeedback(kind: "correct" | "error" | "complete" | "important"): void {
  if (typeof window === "undefined") return;
  const preferences = readFeedbackPreferences();
  if (preferences.vibrations && typeof navigator.vibrate === "function") {
    navigator.vibrate(kind === "error" ? [45, 35, 45] : kind === "important" ? [40, 30, 70] : 35);
  }
  if (!preferences.sounds || document.documentElement.dataset.quranPlaying === "true") return;
  const context = getAudioContext(); if (!context) return;
  try {
    const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.type = "sine"; oscillator.frequency.value = kind === "error" ? 190 : kind === "important" ? 620 : kind === "complete" ? 520 : 440;
    gain.gain.setValueAtTime(0.0001, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.01); gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.13);
  } catch { /* Feedback audio is an optional progressive enhancement. */ }
}

function getAudioContext(): AudioContext | null {
  if (sharedAudioContext) return sharedAudioContext;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  try { sharedAudioContext = new AudioContextClass(); return sharedAudioContext; } catch { return null; }
}
