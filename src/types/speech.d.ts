// SpeechRecognition (speech-to-text) isn't part of TypeScript's built-in
// DOM lib because it was never fully standardized — only Chrome/Edge/some
// Safari versions implement it, usually behind the `webkit` prefix. We
// declare just the minimal shape this app actually uses.

interface SpeechRecognitionResultLike {
  transcript: string;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionEventLike extends Event {
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

interface Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}
