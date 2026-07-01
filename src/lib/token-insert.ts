import { useCallback, useRef } from "react";

type FieldEl = HTMLTextAreaElement | HTMLInputElement;

export function insertAtCursor(
  el: FieldEl | null,
  current: string,
  text: string,
  setValue: (v: string) => void,
): void {
  if (!el) {
    setValue((current ?? "") + text);
    return;
  }
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? current.length;
  const next = current.slice(0, start) + text + current.slice(end);
  setValue(next);
  requestAnimationFrame(() => {
    try {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    } catch {
      /* noop */
    }
  });
}

export function useTokenInserter<T extends FieldEl = HTMLTextAreaElement>(
  getValue: () => string,
  setValue: (v: string) => void,
) {
  const ref = useRef<T | null>(null);
  const insert = useCallback(
    (text: string) => insertAtCursor(ref.current, getValue(), text, setValue),
    [getValue, setValue],
  );
  return { ref, insert };
}
