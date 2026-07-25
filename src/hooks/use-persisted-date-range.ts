// Persiste o intervalo de datas selecionado por usuário em localStorage.
// Chave: `techerp:date-range:<scope>:<userId>`.
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getPresetRange, type DateRange, type PresetKey } from "@/lib/date-presets";

type Stored = { fromISO: string; toISO: string; preset?: PresetKey };

function storageKey(scope: string, userId: string | null) {
  return `techerp:date-range:${scope}:${userId ?? "anon"}`;
}

function readStored(key: string): Stored | null {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as Stored;
    if (!p?.fromISO || !p?.toISO) return null;
    return p;
  } catch {
    return null;
  }
}

export function usePersistedDateRange(
  scope: string,
  defaultPreset: PresetKey = "last30",
): {
  range: DateRange;
  preset: PresetKey | "custom";
  setRange: (r: DateRange, preset?: PresetKey) => void;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [state, setState] = useState<{ range: DateRange; preset: PresetKey | "custom" }>(() => ({
    range: getPresetRange(defaultPreset),
    preset: defaultPreset,
  }));

  // Hidrata do storage após montar (evita SSR mismatch).
  useEffect(() => {
    const stored = readStored(storageKey(scope, userId));
    if (stored) {
      const from = new Date(stored.fromISO);
      const to = new Date(stored.toISO);
      if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
        setState({ range: { from, to }, preset: stored.preset ?? "custom" });
      }
    }
  }, [scope, userId]);

  const setRange = useCallback(
    (r: DateRange, preset?: PresetKey) => {
      setState({ range: r, preset: preset ?? "custom" });
      try {
        window.localStorage.setItem(
          storageKey(scope, userId),
          JSON.stringify({
            fromISO: r.from.toISOString(),
            toISO: r.to.toISOString(),
            preset,
          } satisfies Stored),
        );
      } catch {
        // storage indisponível — ignora
      }
    },
    [scope, userId],
  );

  return { range: state.range, preset: state.preset, setRange };
}
