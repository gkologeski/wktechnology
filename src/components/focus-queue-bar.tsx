// Barra fixa do modo "fila em foco" — fica montada no layout autenticado e
// deriva entidade/registro atual a partir da URL. Assim os atalhos N/S/P/Esc
// e a navegação Próxima/Anterior não causam unmount/flash entre registros.
import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  type FocusEntity,
  advanceFocusQueue,
  clearFocusQueue,
  getFocusQueue,
  previousFocusQueue,
  routeForEntity,
} from "@/lib/focus-queue";

// Detecta entidade + id na URL: /companies/<id>, /contacts/<id>, /leads/<id>, /deals/<id>
const ENTITY_RE = /^\/(companies|contacts|leads|deals)\/([^/?#]+)/;

function parsePath(pathname: string): { entity: FocusEntity; id: string } | null {
  const m = pathname.match(ENTITY_RE);
  if (!m) return null;
  return { entity: m[1] as FocusEntity, id: m[2] };
}

export function FocusQueueBar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [, setTick] = useState(0);

  const match = parsePath(pathname);
  const queue = getFocusQueue();
  const active = !!(
    match &&
    queue &&
    queue.entity === match.entity &&
    queue.ids[queue.index] === match.id
  );

  const entity = match?.entity ?? queue?.entity ?? null;

  const goTo = (ent: FocusEntity, id: string) => {
    if (ent === "companies") navigate({ to: "/companies/$id", params: { id } });
    else if (ent === "contacts") navigate({ to: "/contacts/$id", params: { id } });
    else if (ent === "leads") navigate({ to: "/leads/$id", params: { id } });
    else if (ent === "deals") navigate({ to: "/deals/$id", params: { id } });
  };

  const next = () => {
    const q = getFocusQueue();
    if (!q) return;
    const n = advanceFocusQueue();
    setTick((t) => t + 1);
    if (n) goTo(n.entity, n.ids[n.index]);
    else navigate({ to: routeForEntity(q.entity) });
  };
  const prev = () => {
    const p = previousFocusQueue();
    setTick((t) => t + 1);
    if (p) goTo(p.entity, p.ids[p.index]);
  };
  const exit = () => {
    const q = getFocusQueue();
    clearFocusQueue();
    setTick((t) => t + 1);
    if (q) navigate({ to: routeForEntity(q.entity) });
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!active) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.key === "n" || e.key === "N" || e.key === "s" || e.key === "S") {
        e.preventDefault();
        next();
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        prev();
      } else if (e.key === "Escape") {
        e.preventDefault();
        exit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, entity]);

  if (!active || !queue) return null;
  const pos = queue.index + 1;
  const total = queue.ids.length;
  const pct = Math.round((pos / total) * 100);
  const isLast = queue.index === total - 1;

  return (
    <div className="sticky top-0 z-30 mb-3 flex flex-wrap items-center gap-3 rounded-xl border bg-primary/5 px-4 py-2.5 shadow-sm backdrop-blur">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
          Fila
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{queue.label}</div>
          <div className="text-xs text-muted-foreground">
            {pos} de {total.toLocaleString("pt-BR")} · atalhos:{" "}
            <kbd className="rounded border bg-background px-1">N</kbd> próximo ·{" "}
            <kbd className="rounded border bg-background px-1">S</kbd> pular ·{" "}
            <kbd className="rounded border bg-background px-1">Esc</kbd> sair
          </div>
        </div>
        <div className="hidden min-w-[140px] flex-1 sm:block">
          <Progress value={pct} className="h-1.5" />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={prev} disabled={queue.index === 0}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Anterior
        </Button>
        <Button variant="outline" size="sm" onClick={next}>
          <SkipForward className="mr-1 h-4 w-4" /> Pular
        </Button>
        <Button size="sm" onClick={next}>
          {isLast ? "Finalizar" : "Próxima"} <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={exit} aria-label="Sair da fila">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
