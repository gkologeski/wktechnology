// Rascunho local (por usuário) de janelas de atividade: salva ao digitar e ao fechar.
import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "activity-draft:";
const DEBOUNCE_MS = 500;

type Stored<T> = { value: T; savedAt: string };

export function activityDraftKey(userId: string | undefined, parts: Array<string | undefined>) {
  if (!userId) return null;
  return `${PREFIX}${userId}:${parts.map((p) => p ?? "-").join(":")}`;
}

function read<T>(key: string): Stored<T> | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Stored<T>) : null;
  } catch {
    return null;
  }
}

export function useActivityDraft<T>(options: {
  key: string | null;
  value: T;
  isEmpty: (value: T) => boolean;
  onRestore: (value: T) => void;
}) {
  const { key, value, isEmpty } = options;
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const hydrated = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const onRestore = useRef(options.onRestore);
  onRestore.current = options.onRestore;

  const write = useCallback(
    (v: T) => {
      if (!key) return;
      try {
        if (isEmpty(v)) {
          window.localStorage.removeItem(key);
          setSavedAt(null);
          return;
        }
        const now = new Date().toISOString();
        window.localStorage.setItem(key, JSON.stringify({ value: v, savedAt: now }));
        setSavedAt(now);
      } catch {
        /* armazenamento indisponível */
      }
    },
    [key, isEmpty],
  );

  useEffect(() => {
    hydrated.current = false;
    if (!key) return;
    const stored = read<T>(key);
    if (stored) {
      onRestore.current(stored.value);
      setSavedAt(stored.savedAt);
      setRestored(true);
    }
    const t = setTimeout(() => (hydrated.current = true), 0);
    return () => {
      clearTimeout(t);
      if (timer.current) clearTimeout(timer.current);
      pending.current?.();
      pending.current = null;
    };
  }, [key]);

  const serialized = JSON.stringify(value);
  useEffect(() => {
    if (!key || !hydrated.current) return;
    if (timer.current) clearTimeout(timer.current);
    const v = value;
    pending.current = () => write(v);
    timer.current = setTimeout(() => {
      pending.current = null;
      write(v);
    }, DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, serialized]);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    pending.current = null;
    if (key) window.localStorage.removeItem(key);
    setSavedAt(null);
    setRestored(false);
  }, [key]);

  return { savedAt, restored, clear };
}

/** Remove todos os rascunhos locais de atividade (ex.: ao sair da conta). */
export function clearAllActivityDrafts() {
  try {
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
