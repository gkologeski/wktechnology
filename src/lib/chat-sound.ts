// Preferência de som de mensagens novas no chat (por usuário, no navegador).
import { useEffect, useState } from "react";

const KEY = "chat:sound:enabled";
const EVT = "chat:sound:changed";

export function isChatSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = window.localStorage.getItem(KEY);
  return v === null ? true : v === "1";
}

export function setChatSoundEnabled(v: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, v ? "1" : "0");
  window.dispatchEvent(new CustomEvent(EVT, { detail: v }));
}

export function useChatSoundEnabled(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState<boolean>(() => isChatSoundEnabled());
  useEffect(() => {
    const h = () => setV(isChatSoundEnabled());
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return [v, setChatSoundEnabled];
}

// Beep curto via WebAudio — não exige asset.
let ctx: AudioContext | null = null;
export function playMessageSound() {
  if (typeof window === "undefined") return;
  if (!isChatSoundEnabled()) return;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    const c = ctx;
    if (c.state === "suspended") c.resume().catch(() => {});
    const now = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, now);
    o.frequency.exponentialRampToValueAtTime(660, now + 0.12);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    o.connect(g).connect(c.destination);
    o.start(now);
    o.stop(now + 0.25);
  } catch {
    // ignore
  }
}
