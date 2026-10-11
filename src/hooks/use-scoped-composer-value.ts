import { useCallback, useState, type SetStateAction } from "react";

// A late upload or restore may complete after another conversation was selected.
// Keep its value associated with the originating scope, never the new recipient.
export function useScopedComposerValue<T>(scope: string | null, initial: T) {
  const [values, setValues] = useState<Map<string | null, T>>(() => new Map());
  const setValue = useCallback(
    (value: SetStateAction<T>) =>
      setValues((previous) => {
        const current = previous.has(scope) ? previous.get(scope)! : initial;
        const next = typeof value === "function" ? (value as (v: T) => T)(current) : value;
        return new Map(previous).set(scope, next);
      }),
    [scope, initial],
  );
  return [values.has(scope) ? values.get(scope)! : initial, setValue] as const;
}
