export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function isSttSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/** Reads text aloud, cancelling anything currently being spoken first. */
export function speak(text: string, lang = 'en-IN'): void {
  if (!isTtsSupported() || !text.trim()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (isTtsSupported()) window.speechSynthesis.cancel();
}

/**
 * Starts listening for a single spoken utterance and resolves with the
 * transcript. Rejects if the browser doesn't support SpeechRecognition at
 * all, or if recognition fails/times out — callers should catch and show
 * a friendly fallback rather than a raw error.
 */
export function listenOnce(lang = 'en-IN'): Promise<string> {
  return new Promise((resolve, reject) => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      reject(new Error('Voice input is not supported in this browser. Try Chrome or Edge.'));
      return;
    }
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    const timeout = setTimeout(() => {
      recognition.stop();
      reject(new Error("Didn't hear anything — try again."));
    }, 8000);

    recognition.onresult = (event) => {
      clearTimeout(timeout);
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      resolve(transcript);
    };
    recognition.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Could not hear you clearly. Check microphone permission and try again.'));
    };
    recognition.onend = () => clearTimeout(timeout);

    recognition.start();
  });
}
