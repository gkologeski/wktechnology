import { useState } from "react";
import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AtsSectionHeader, EmptyState } from "@/components/ats/ui";
import { MetaPill } from "@/components/techhire/ui";
import type { App, JobInterview } from "@/components/ats/jobs/job-detail.types";

export function JobInterviewsPanel({
  apps,
  interviews,
  onSchedule,
}: {
  apps: App[];
  interviews: JobInterview[];
  onSchedule: (app: App) => void;
}) {
  const [schedSearch, setSchedSearch] = useState("");
  const [schedActiveOnly, setSchedActiveOnly] = useState(true);

  const applicantsForScheduling = apps.filter((a) => {
    if (schedActiveOnly && (a.status ?? "active") !== "active") return false;
    if (!schedSearch.trim()) return true;
    const q = schedSearch.trim().toLowerCase();
    const cand = (a as unknown as { candidate?: { full_name?: string | null } | null }).candidate;
    const name = (cand?.full_name ?? "").toLowerCase();
    const stage = (a.stage_value ?? "").toLowerCase();
    return name.includes(q) || stage.includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border-subtle bg-surface-1 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <AtsSectionHeader
              title="Agendar entrevista"
              description={`Selecione um candidato para marcar entrevista. ${applicantsForScheduling.length} candidato(s).`}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Input
            value={schedSearch}
            onChange={(e) => setSchedSearch(e.target.value)}
            placeholder="Buscar por nome ou estágio…"
            className="h-8 max-w-xs"
          />
          <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={schedActiveOnly}
              onChange={(e) => setSchedActiveOnly(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Somente ativos
          </label>
        </div>
        {applicantsForScheduling.length === 0 ? (
          <p className="text-xs text-text-tertiary">
            Nenhum candidato encontrado. Assim que aparecerem na aba Pipeline, você poderá agendar
            entrevistas aqui.
          </p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 max-h-[420px] overflow-y-auto pr-1">
            {applicantsForScheduling.map((a) => {
              const cand = (a as unknown as { candidate?: { full_name?: string | null } | null })
                .candidate;
              const name = cand?.full_name ?? "Candidato";
              return (
                <button
                  key={a.id as string}
                  type="button"
                  onClick={() => onSchedule(a)}
                  className="flex items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-left text-sm hover:border-border-strong hover:bg-surface-3 transition"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-text-primary truncate">{name}</div>
                    <div className="text-[11px] text-text-tertiary truncate">
                      {a.stage_value ?? "applied"}
                    </div>
                  </div>
                  <Calendar className="h-4 w-4 text-text-tertiary shrink-0" aria-hidden />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {interviews.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Nenhuma entrevista agendada"
          description="As entrevistas agendadas para esta vaga aparecerão aqui."
        />
      ) : (
        <div className="rounded-lg border border-border-subtle bg-surface-1 divide-y divide-border-subtle">
          {interviews.map((iv) => (
            <div key={iv.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-text-primary truncate">
                  {iv.candidate_name ?? "Candidato"}
                </div>
                <div className="text-xs text-text-tertiary truncate">
                  {iv.kind ?? "Entrevista"} · {iv.stage_value ?? "—"}
                  {iv.location ? ` · ${iv.location}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <MetaPill>{iv.status}</MetaPill>
                <span className="text-xs text-text-tertiary tabular-nums">
                  {iv.scheduled_at
                    ? new Date(iv.scheduled_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
