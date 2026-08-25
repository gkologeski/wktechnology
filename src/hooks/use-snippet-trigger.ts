// Hook para detectar o gatilho "/atalho" em <input>/<textarea> e mostrar
// um popover com sugestões de snippets. Faz a substituição inline quando
// o usuário escolhe um item.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listSnippets as listSnippetsFn,
  incrementSnippetUsage as incrementSnippetUsageFn,
  type SnippetRow,
} from "@/lib/snippets.functions";
import { htmlToPlain } from "@/components/rich-html-editor";

const TRIGGER_RE = /(^|\s)\/([a-zA-Z0-9_\-/]*)$/;

export type SnippetTriggerState = {
  active: boolean;
  query: string;
  results: SnippetRow[];
  activeIdx: number;
  anchor: HTMLElement | null;
  setActiveIdx: (n: number) => void;
  close: () => void;
  pickCurrent: () => void;
  pick: (s: SnippetRow) => void;
};

type UseSnippetTriggerArgs = {
  ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  enabled?: boolean;
  /** Se `true`, o valor é HTML e usamos body_html; caso contrário, body_text. */
  html?: boolean;
};

/**
 * Fornece detecção de gatilho `/atalho` em campos simples (input/textarea).
 * Para o `RichHtmlEditor`, existe integração dedicada dentro do componente.
 */
export function useSnippetTrigger({
  ref,
  value,
  onChange,
  enabled = true,
  html = false,
}: UseSnippetTriggerArgs): SnippetTriggerState & {
  onKeyDown: React.KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>;
} {
  const list = useServerFn(listSnippetsFn);
  const inc = useServerFn(incrementSnippetUsageFn);

  const [active, setActive] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rangeRef = useRef<{ start: number; end: number } | null>(null);

  const q = useQuery({
    queryKey: ["snippets", "picker"],
    queryFn: () => list({ data: { visibility: "all" } }),
    enabled,
    staleTime: 30_000,
  });

  const results = useMemo(() => {
    const items = q.data?.items ?? [];
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? items.filter(
          (s) => s.shortcut.toLowerCase().includes(needle) || s.name.toLowerCase().includes(needle),
        )
      : items;
    return filtered.slice(0, 8);
  }, [q.data, query]);

  const close = useCallback(() => {
    setActive(false);
    setQuery("");
    setActiveIdx(0);
    rangeRef.current = null;
  }, []);

  const detect = useCallback(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const pos = el.selectionStart ?? 0;
    const textBefore = value.slice(0, pos);
    const match = TRIGGER_RE.exec(textBefore);
    if (!match) {
      if (active) close();
      return;
    }
    const start = pos - match[0].length + match[1].length;
    rangeRef.current = { start, end: pos };
    setQuery(match[2]);
    setActive(true);
    setActiveIdx(0);
  }, [ref, value, enabled, active, close]);

  useEffect(() => {
    detect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const pick = useCallback(
    (s: SnippetRow) => {
      const el = ref.current;
      const range = rangeRef.current;
      if (!el || !range) {
        close();
        return;
      }
      const insertion = html
        ? s.body_html || s.body_text
        : s.body_text || htmlToPlain(s.body_html || "");
      const next = value.slice(0, range.start) + insertion + value.slice(range.end);
      onChange(next);
      // Restaura foco e posição do cursor
      requestAnimationFrame(() => {
        try {
          el.focus();
          const caret = range.start + insertion.length;
          el.setSelectionRange(caret, caret);
        } catch {
          /* noop */
        }
      });
      void inc({ data: { id: s.id } }).catch(() => {
        /* silencioso */
      });
      close();
    },
    [ref, value, onChange, html, close, inc],
  );

  const pickCurrent = useCallback(() => {
    const s = results[activeIdx];
    if (s) pick(s);
  }, [results, activeIdx, pick]);

  const onKeyDown = useCallback<React.KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>>(
    (e) => {
      if (!active || results.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + results.length) % results.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pickCurrent();
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    },
    [active, results, pickCurrent, close],
  );

  return {
    active: active && results.length > 0,
    query,
    results,
    activeIdx,
    setActiveIdx,
    anchor: ref.current,
    close,
    pickCurrent,
    pick,
    onKeyDown,
  };
}
