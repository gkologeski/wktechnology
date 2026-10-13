// Visualização livre do fluxo: arrastar o fundo, rolar com trackpad/roda,
// zoom com Ctrl/Cmd + roda ou pinça, botões de zoom e setas do teclado.
// Só muda a visualização; blocos, botões e arrastar passos seguem iguais.
import * as React from "react";
import { Minus, Plus, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clampZoom, zoomAround, type Viewport } from "./pan-zoom-math";

const INTERACTIVE =
  "button, a, input, textarea, select, label, [role='button'], [role='menuitem'], [draggable='true'], [data-step-path] .border";

export function PanZoomViewport({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [vp, setVp] = React.useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const drag = React.useRef<{ id: number; sx: number; sy: number; ox: number; oy: number } | null>(
    null,
  );

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.01);
        setVp((v) => zoomAround(v, v.zoom * factor, e.clientX - rect.left, e.clientY - rect.top));
      } else {
        setVp((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: vp.x, oy: vp.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setVp((v) => ({ ...v, x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy }));
  };
  const endDrag = (e: React.PointerEvent) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    const step = 40;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      setVp((v) => ({ ...v, x: v.x + m[0], y: v.y + m[1] }));
    } else if (e.key === "+" || e.key === "=")
      setVp((v) => ({ ...v, zoom: clampZoom(v.zoom * 1.2) }));
    else if (e.key === "-") setVp((v) => ({ ...v, zoom: clampZoom(v.zoom / 1.2) }));
    else if (e.key === "0") setVp({ x: 0, y: 0, zoom: 1 });
  };
  const zoomBy = (f: number) => {
    const el = ref.current;
    const w = el?.clientWidth ?? 0;
    const h = el?.clientHeight ?? 0;
    setVp((v) => zoomAround(v, v.zoom * f, w / 2, h / 2));
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={ref}
        tabIndex={0}
        role="region"
        aria-label="Desenho do fluxo. Arraste o fundo ou use as setas para mover; + e − para zoom."
        className="h-full w-full cursor-grab touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <div
          className="origin-top-left cursor-default"
          style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` }}
          data-testid="wf-canvas-world"
        >
          {children}
        </div>
      </div>
      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md border bg-background/95 p-1 shadow-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Diminuir zoom"
          onClick={() => zoomBy(1 / 1.2)}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span
          className="w-12 text-center text-xs tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {Math.round(vp.zoom * 100)}%
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Aumentar zoom"
          onClick={() => zoomBy(1.2)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Voltar para 100% e centralizar"
          onClick={() => setVp({ x: 0, y: 0, zoom: 1 })}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
