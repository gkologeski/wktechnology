import { Calendar } from "lucide-react";
import { EmptyState } from "@/components/ats/ui";
import type { JobEvent } from "@/components/ats/jobs/job-detail.types";

export function JobActivityTimeline({ events }: { events: JobEvent[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="Sem atividade ainda"
        description="Movimentações no pipeline e eventos da vaga aparecerão aqui."
      />
    );
  }

  return (
    <ol className="space-y-2">
      {events.map((ev) => (
        <li
          key={ev.id}
          className="flex items-start gap-3 rounded-md border border-border-subtle bg-surface-1 p-3 text-sm"
        >
          <div className="mt-1 h-2 w-2 rounded-full bg-primary/70 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-text-primary">
              <span className="font-medium">{ev.candidate_name ?? "Candidato"}</span>{" "}
              <span className="text-text-tertiary">— {ev.event_type}</span>
            </div>
            {(ev.from_stage || ev.to_stage) && (
              <div className="mt-0.5 text-xs text-text-tertiary">
                {ev.from_stage ?? "—"} → {ev.to_stage ?? "—"}
              </div>
            )}
          </div>
          <span className="text-xs text-text-tertiary tabular-nums shrink-0">
            {new Date(ev.created_at).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </li>
      ))}
    </ol>
  );
}
