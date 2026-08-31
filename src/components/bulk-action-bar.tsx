import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { GripVertical, X } from "lucide-react";

export type BulkActionBarProps = {
  count: number;
  onClear: () => void;
  children: ReactNode;
  /** Total de registros que atendem aos filtros atuais (em todas as páginas). */
  totalMatching?: number;
  /** Acionado para selecionar todos os registros que atendem aos filtros. */
  onSelectAll?: () => void;
  isSelectingAll?: boolean;
};

/** Posição persistida da barra (canto superior esquerdo, em px da janela). */
type BarPosition = { x: number; y: number };

const POSITION_KEY = "bulk-bar:position";
const MARGIN = 8;
const STEP = 16;

function readStoredPosition(): BarPosition | null {
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as BarPosition).x === "number" &&
      typeof (parsed as BarPosition).y === "number"
    ) {
      return parsed as BarPosition;
    }
  } catch {
    /* posição inválida: usa o padrão */
  }
  return null;
}

export function BulkActionBar({
  count,
  onClear,
  children,
  totalMatching,
  onSelectAll,
  isSelectingAll,
}: BulkActionBarProps) {
  const showSelectAll = typeof totalMatching === "number" && totalMatching > count && !!onSelectAll;
  const barRef = useRef<HTMLDivElement>(null);
  // `null` = posição padrão (rodapé centralizado).
  const [position, setPosition] = useState<BarPosition | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    setPosition(readStoredPosition());
    setHydrated(true);
  }, []);

  /** Mantém a barra dentro da área visível. */
  const clamp = useCallback((pos: BarPosition): BarPosition => {
    const el = barRef.current;
    const width = el?.offsetWidth ?? 0;
    const height = el?.offsetHeight ?? 0;
    const maxX = Math.max(MARGIN, window.innerWidth - width - MARGIN);
    const maxY = Math.max(MARGIN, window.innerHeight - height - MARGIN);
    return {
      x: Math.min(Math.max(pos.x, MARGIN), maxX),
      y: Math.min(Math.max(pos.y, MARGIN), maxY),
    };
  }, []);

  const persist = useCallback((pos: BarPosition | null) => {
    try {
      if (pos) localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
      else localStorage.removeItem(POSITION_KEY);
    } catch {
      /* armazenamento indisponível: mantém apenas em memória */
    }
  }, []);

  const move = useCallback(
    (pos: BarPosition) => {
      const next = clamp(pos);
      setPosition(next);
      persist(next);
    },
    [clamp, persist],
  );

  const reset = useCallback(() => {
    setPosition(null);
    persist(null);
  }, [persist]);

  // Reposiciona quando a janela muda de tamanho.
  useEffect(() => {
    if (!position) return;
    const onResize = () => setPosition((p) => (p ? clamp(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [position, clamp]);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.preventDefault();
    move({ x: e.clientX - drag.dx, y: e.clientY - drag.dy });
  };

  const endDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const onHandleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Escape") {
      reset();
      return;
    }
    const deltas: Record<string, BarPosition> = {
      ArrowLeft: { x: -STEP, y: 0 },
      ArrowRight: { x: STEP, y: 0 },
      ArrowUp: { x: 0, y: -STEP },
      ArrowDown: { x: 0, y: STEP },
    };
    const delta = deltas[e.key];
    if (!delta) return;
    e.preventDefault();
    const rect = barRef.current?.getBoundingClientRect();
    const base = position ?? (rect ? { x: rect.left, y: rect.top } : { x: MARGIN, y: MARGIN });
    move({ x: base.x + delta.x, y: base.y + delta.y });
  };

  const positioned = hydrated && position;

  return (
    <div
      ref={barRef}
      style={positioned ? { left: position.x, top: position.y } : undefined}
      className={
        positioned
          ? "fixed z-40 flex w-fit max-w-[calc(100vw-1rem)] flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-lg"
          : "fixed bottom-4 inset-x-4 z-40 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-lg"
      }
    >
      <button
        type="button"
        aria-label="Mover barra de ações (use as setas; Esc restaura a posição padrão)"
        title="Arraste para mover. Setas movem, Esc restaura."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={reset}
        onKeyDown={onHandleKeyDown}
        className="-ml-1 cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <Button variant="ghost" size="icon" onClick={onClear} aria-label="Limpar seleção">
        <X className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium">
        {count.toLocaleString("pt-BR")} selecionado{count === 1 ? "" : "s"}
      </span>
      {showSelectAll && (
        <Button
          variant="link"
          size="sm"
          className="h-7 px-1 text-xs"
          disabled={isSelectingAll}
          onClick={onSelectAll}
        >
          {isSelectingAll
            ? "Selecionando…"
            : `Selecionar todos os ${totalMatching!.toLocaleString("pt-BR")} registros`}
        </Button>
      )}
      <div className="ml-auto flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
