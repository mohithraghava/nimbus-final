/** Read an answer aloud. Returns true if speech started, false if it stopped, null if the browser has no speech. */
export function toggleSpeech(text: string): boolean | null {
  const s = window.speechSynthesis;
  if (!s) return null;
  if (s.speaking || s.pending) { s.cancel(); return false; }
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const u = new SpeechSynthesisUtterance(clean.slice(0, 1500));
  u.rate = 1;
  u.lang = "en-GB";
  s.speak(u);
  return true;
}
