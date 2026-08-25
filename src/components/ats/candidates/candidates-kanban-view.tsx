import { Link } from "@tanstack/react-router";
import { Briefcase, MapPin, Flame, Target } from "lucide-react";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SourceBadge } from "@/components/ats/ui";
import { MetaPill } from "@/components/techhire/ui";
import { KanbanScrollContainer } from "@/components/kanban/kanban-scroll-container";
import { KanbanSignalIcons, kanbanBorderStyle } from "@/components/kanban/kanban-signal-indicator";
import { cn } from "@/lib/utils";
import type { computeCandidateSignals } from "@/lib/kanban/candidates-signals";
import {
  DERIVED_STATUS_LABELS,
  type DerivedCandidateStatus,
} from "@/lib/ats/candidate-status.functions";
import type { setCandidateArchived } from "@/lib/ats/ats.functions";
import { STATUS_ORDER, CandidateStatusPill } from "./candidate-status-pill";
import type { Cand } from "./types";

export function CandidatesKanbanView({
  rows,
  statuses,
  focusMode,
  onFocusModeChange,
  candSignals,
  draggingId,
  setDraggingId,
  dragOverCol,
  setDragOverCol,
  archiveCandidate,
  queryClient,
  onNeedsAssociation,
}: {
  rows: Cand[];
  statuses: Record<string, DerivedCandidateStatus>;
  focusMode: boolean;
  onFocusModeChange: (v: boolean) => void;
  candSignals: ReturnType<typeof computeCandidateSignals>;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  dragOverCol: DerivedCandidateStatus | null;
  setDragOverCol: (s: DerivedCandidateStatus | null) => void;
  archiveCandidate: ReturnType<
    typeof import("@tanstack/react-start").useServerFn<typeof setCandidateArchived>
  >;
  queryClient: QueryClient;
  onNeedsAssociation: (candidateId: string, candidateName: string) => void;
}) {
  return (
    <>
      <div className="mb-2 flex justify-end">
        <Button
          size="sm"
          variant={focusMode ? "default" : "outline"}
          onClick={() => onFocusModeChange(!focusMode)}
          aria-pressed={focusMode}
          title="Reordena por estagnação por estágio e esmaece candidatos em movimento"
          className="h-8"
        >
          <Target className="h-4 w-4 mr-1" />
          Modo de foco
        </Button>
      </div>
      <KanbanScrollContainer ariaLabel="Quadro de candidatos">
        <div className="flex gap-2 pb-4">
          {STATUS_ORDER.map((s) => {
            const rawCol = rows.filter((r) => (statuses[r.id as string] ?? "new") === s);
            const colRows = focusMode
              ? [...rawCol].sort(
                  (a, b) =>
                    (candSignals.get(b.id as string)?.score ?? 0) -
                    (candSignals.get(a.id as string)?.score ?? 0),
                )
              : rawCol;
            const hotCount = colRows.reduce(
              (n, r) => n + (candSignals.get(r.id as string)?.isHot ? 1 : 0),
              0,
            );
            const isOver = dragOverCol === s;

            const handleDrop = async (candidateId: string) => {
              const candidate = rows.find((r) => r.id === candidateId);
              if (!candidate) return;
              const from = (statuses[candidateId] ?? "new") as DerivedCandidateStatus;
              if (from === s) return;

              // *  →  archived  → mutação segura
              if (s === "archived") {
                try {
                  await archiveCandidate({ data: { id: candidateId, archived: true } });
                  toast.success(`${candidate.full_name as string} arquivado`);
                  void queryClient.invalidateQueries({ queryKey: ["ats-candidate-statuses"] });
                  void queryClient.invalidateQueries({ queryKey: ["ats-candidates"] });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Falha ao arquivar");
                }
                return;
              }
              // archived → new  → desarquivar
              if (from === "archived" && s === "new") {
                try {
                  await archiveCandidate({ data: { id: candidateId, archived: false } });
                  toast.success(`${candidate.full_name as string} desarquivado`);
                  void queryClient.invalidateQueries({ queryKey: ["ats-candidate-statuses"] });
                  void queryClient.invalidateQueries({ queryKey: ["ats-candidates"] });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Falha ao desarquivar");
                }
                return;
              }
              // new → in_process  → exige associação a uma vaga (abre diálogo)
              if (from === "new" && s === "in_process") {
                onNeedsAssociation(candidateId, candidate.full_name as string);
                toast.message("Associe o candidato a uma vaga para movê-lo para 'Em processo'");
                return;
              }
              // demais transições — não há mutação direta segura
              toast.warning(
                `Transição "${DERIVED_STATUS_LABELS[from]}" → "${DERIVED_STATUS_LABELS[s]}" precisa ser feita pelo fluxo da vaga (entrevista, oferta, etc.).`,
              );
            };
            return (
              <div
                key={s}
                data-kanban-column-root={s}
                onDragOver={(e) => {
                  if (!draggingId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverCol !== s) setDragOverCol(s);
                }}
                onDragLeave={(e) => {
                  if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node))
                    setDragOverCol(dragOverCol === s ? null : dragOverCol);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || draggingId;
                  setDragOverCol(null);
                  setDraggingId(null);
                  if (id) void handleDrop(id);
                }}
                className={cn(
                  "flex w-[280px] shrink-0 flex-col rounded-md border bg-surface-sunken transition-colors",
                  isOver ? "border-primary/60 ring-1 ring-primary/30" : "border-border-subtle",
                )}
              >
                <div className="sticky top-0 z-10 rounded-t-md border-b border-border-subtle bg-surface-sunken px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <CandidateStatusPill status={s} />
                    <span className="flex items-center gap-1 text-[11px] tabular-nums text-text-tertiary">
                      {hotCount > 0 && (
                        <span
                          className="inline-flex items-center gap-0.5"
                          title={`${hotCount} parado(s)`}
                          style={{ color: "var(--hs-orange)" }}
                        >
                          <Flame className="h-3 w-3" aria-hidden />
                          {hotCount}
                        </span>
                      )}
                      <span>{colRows.length}</span>
                    </span>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5 p-2 min-h-[200px]">
                  {colRows.map((c) => {
                    const skills = Array.isArray(c.skills) ? (c.skills as string[]) : [];
                    const cid = c.id as string;
                    const sig = candSignals.get(cid);
                    const dim = focusMode && sig?.klass === "cold";
                    return (
                      <Link
                        key={cid}
                        to="/candidates/$id"
                        params={{ id: cid }}
                        data-kanban-card
                        data-kanban-column={s}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", cid);
                          setDraggingId(cid);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverCol(null);
                        }}
                        style={kanbanBorderStyle(sig)}
                        className={cn(
                          "block rounded-md border border-border-subtle bg-surface-1 p-2.5",
                          "transition-all hover:border-border-strong hover:shadow-sm",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          "cursor-grab active:cursor-grabbing",
                          draggingId === cid && "opacity-50",
                          dim && "opacity-60",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="truncate text-sm font-medium text-text-primary">
                            {c.full_name as string}
                          </div>
                          <KanbanSignalIcons signals={sig} />
                        </div>

                        {c.current_position ? (
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-text-secondary">
                            <Briefcase className="h-3 w-3 shrink-0 text-text-tertiary" aria-hidden />
                            <span className="truncate">
                              {c.current_position}
                              {c.current_company ? ` @ ${c.current_company}` : ""}
                            </span>
                          </div>
                        ) : null}
                        {c.location ? (
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-text-tertiary">
                            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                            <span className="truncate">{c.location as string}</span>
                          </div>
                        ) : null}
                        {skills.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {skills.slice(0, 3).map((sk) => (
                              <MetaPill key={sk}>{sk}</MetaPill>
                            ))}
                            {skills.length > 3 ? <MetaPill>+{skills.length - 3}</MetaPill> : null}
                          </div>
                        ) : null}
                        {c.source ? (
                          <div className="mt-2 border-t border-border-subtle pt-2">
                            <SourceBadge source={c.source as string} />
                          </div>
                        ) : null}
                      </Link>
                    );
                  })}
                  {colRows.length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-text-tertiary">
                      {isOver ? "Solte aqui" : "Vazio"}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </KanbanScrollContainer>
    </>
  );
}
