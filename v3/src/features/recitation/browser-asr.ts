"use client";

type SpeechAlternative = { transcript: string; confidence: number };
type SpeechResult = { 0: SpeechAlternative; isFinal: boolean };
type SpeechEvent = { results: ArrayLike<SpeechResult>; resultIndex?: number };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type SpeechConstructor = new () => SpeechRecognitionLike;

export type BrowserAsrController = { stop(): void };

export function startBrowserAsr(callbacks: {
  onTranscript: (transcript: string, confidence?: number) => void;
  onUnavailable: () => void;
  onError: (code: string) => void;
  onEnd: () => void;
}): BrowserAsrController | null {
  const scope = window as typeof window & { SpeechRecognition?: SpeechConstructor; webkitSpeechRecognition?: SpeechConstructor };
  const Constructor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  if (!Constructor) { callbacks.onUnavailable(); return null; }
  const recognition = new Constructor();
  let active = true;
  let finalText = "";
  recognition.lang = "ar-MA";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    let interim = "";
    let confidence: number | undefined;
    for (let index = event.resultIndex ?? 0; index < event.results.length; index += 1) {
      const result = event.results[index];
      const alternative = result?.[0];
      if (!alternative) continue;
      if (result.isFinal) { finalText = `${finalText} ${alternative.transcript}`.trim(); confidence = alternative.confidence; }
      else interim += ` ${alternative.transcript}`;
    }
    callbacks.onTranscript(`${finalText}${interim}`.trim(), confidence);
  };
  recognition.onerror = (event) => {
    const code = event.error ?? "speech_recognition_error";
    if (code !== "no-speech" && code !== "aborted") callbacks.onError(code);
  };
  recognition.onend = () => {
    if (active) {
      window.setTimeout(() => { if (active) try { recognition.start(); } catch { callbacks.onError("restart_failed"); } }, 180);
    } else callbacks.onEnd();
  };
  try { recognition.start(); } catch { callbacks.onError("start_failed"); return null; }
  return { stop() { active = false; recognition.stop(); } };
}

