// Uma linha da aba "Negócios" da conciliação (apresentação pura).
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/techhire/ui";
import { CRITERION_LABEL, NATURE_LABEL, formatHms } from "@/lib/projects/deal-delivery-labels";
import type { HistoryRow } from "@/lib/projects/deal-delivery-history.server";

export type Pair = { dealId: string; projectId: string; criterion: string; label: string };
const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");

export function DealHistoryRow({
  r,
  selected,
  pairs,
  manualPairs,
  onToggleDeal,
  onTogglePair,
  onPick,
}: {
  r: HistoryRow;
  selected: boolean;
  pairs: Map<string, Pair>;
  manualPairs: Pair[];
  onToggleDeal: (on: boolean) => void;
  onTogglePair: (p: Pair, on: boolean) => void;
  onPick: () => void;
}) {
  return (
    <li className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <label className="flex min-w-0 items-start gap-2">
          {r.n_projects === 0 && (
            <Checkbox
              aria-label={`Selecionar ${r.name} para criar projeto`}
              checked={selected}
              onCheckedChange={(v) => onToggleDeal(v === true)}
            />
          )}
          <span className="min-w-0">
            <Link to="/deals/$id" params={{ id: r.id }} className="font-medium hover:underline">
              {r.name}
            </Link>
            <span className="block text-xs text-muted-foreground">
              Ganho em {fmtDate(r.closed_at)} · {r.company?.name ?? "sem empresa"} ·{" "}
              {r.contracts.length} contrato(s) · {r.services} serviço(s)
            </span>
          </span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(r.nature ?? []).map((n) => (
            <StatusBadge key={n} status="draft" label={NATURE_LABEL[n] ?? n} />
          ))}
          {r.projects.map((p) => (
            <StatusBadge key={p.id} status="open" label={`Projeto: ${p.name}`} />
          ))}
        </div>
      </div>
      {r.n_projects === 0 && (
        <div className="space-y-1">
          {r.candidates.length === 0 && (
            <p className="text-xs text-muted-foreground">Sem candidatos automáticos.</p>
          )}
          {r.candidates.map((c) => {
            const k = `${r.id}:${c.project_id}`;
            return (
              <label key={k} className="flex flex-wrap items-center gap-2 text-sm">
                <Checkbox
                  aria-label={`Vincular ${c.name} a ${r.name}`}
                  checked={pairs.has(k)}
                  onCheckedChange={(v) =>
                    onTogglePair(
                      {
                        dealId: r.id,
                        projectId: c.project_id,
                        criterion: c.criterion,
                        label: c.name,
                      },
                      v === true,
                    )
                  }
                />
                <span className="font-medium">{c.name}</span>
                <StatusBadge
                  status={c.exact ? "open" : "onhold"}
                  label={CRITERION_LABEL[c.criterion] ?? c.criterion}
                />
                <span className="text-xs text-muted-foreground">
                  {formatHms(c.logged_seconds ?? 0)} h
                  {c.days_from_close !== null
                    ? ` · 1º apontamento ${c.days_from_close >= 0 ? `${c.days_from_close} dia(s) depois` : `${-c.days_from_close} dia(s) antes`} do ganho`
                    : ""}
                  {c.project_has_deal ? " · já atende outro negócio" : ""}
                </span>
              </label>
            );
          })}
          {manualPairs
            .filter(
              (p) => p.dealId === r.id && !r.candidates.some((c) => c.project_id === p.projectId),
            )
            .map((p) => (
              <p key={p.projectId} className="text-sm">
                Escolha manual: <span className="font-medium">{p.label}</span>
              </p>
            ))}
          <Button variant="ghost" size="sm" onClick={() => onPick()}>
            Buscar outro projeto
          </Button>
        </div>
      )}
    </li>
  );
}
