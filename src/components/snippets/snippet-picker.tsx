// Popover de sugestões para o gatilho de snippet.
// Ancorado no campo textual; navegação por teclado é feita no hook.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Slash } from "lucide-react";
import type { SnippetRow } from "@/lib/snippets.functions";

type Props = {
  anchor: HTMLElement | null;
  results: SnippetRow[];
  activeIdx: number;
  onHoverIdx: (n: number) => void;
  onPick: (s: SnippetRow) => void;
};

export function SnippetPicker({ anchor, results, activeIdx, onHoverIdx, onPick }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setPos({ top: rect.bottom + 4 + window.scrollY, left: rect.left + window.scrollX });
  }, [anchor, results.length]);

  // Rolar item ativo para dentro do viewport do popover
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const item = wrap.querySelector<HTMLButtonElement>(`[data-idx="${activeIdx}"]`);
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  if (!pos || results.length === 0) return null;

  return (
    <div
      ref={wrapRef}
      role="listbox"
      aria-label="Snippets"
      className="fixed z-[70] w-80 max-h-72 overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {results.map((s, i) => (
        <button
          type="button"
          key={s.id}
          data-idx={i}
          role="option"
          aria-selected={i === activeIdx}
          onMouseEnter={() => onHoverIdx(i)}
          onClick={() => onPick(s)}
          className={`flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm ${
            i === activeIdx ? "bg-muted" : "hover:bg-muted/60"
          }`}
        >
          <Slash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">/{s.shortcut}</span>
              <span className="truncate text-xs text-muted-foreground">{s.name}</span>
              {s.visibility === "shared" && (
                <span className="ml-auto rounded bg-primary/10 px-1 text-[10px] text-primary">
                  compartilhado
                </span>
              )}
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {s.body_text || (s.body_html ? s.body_html.replace(/<[^>]+>/g, " ") : "")}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
