import { FormSection } from "@/components/techhire/ui";
import { Badge } from "@/components/ui/badge";
import { useEconomics } from "./economics-panel";
import {
  econComponentLabel,
  econEventLabel,
  econModalityLabel,
  econMonthLabel,
  econProrationLabel,
  econStatusLabel,
  money,
} from "./economics-types";
import type { RequestKind, PreparationRow } from "./types";

const when = (d: string) => new Date(d).toLocaleString("pt-BR");

/** Center column: immutable plan versions, Finance decisions and chained provision revisions. */
export function EconomicsHistory({ kind, row }: { kind: RequestKind; row: PreparationRow }) {
  const { view, q } = useEconomics(kind, row);
  const c = q.data;
  if (!view || !c?.started || !c.can_view) return null;
  return (
    <FormSection title="Histórico do plano econômico">
      {!c.plan && (
        <p className="text-sm text-muted-foreground">Nenhum plano econômico registrado.</p>
      )}
      {c.plan && (
        <p className="text-sm">
          <Badge variant="outline">{econStatusLabel[c.plan.status]}</Badge> versão atual v
          {c.plan.version}
        </p>
      )}
      <ol className="space-y-4 text-sm">
        {[...c.versions].reverse().map((v) => (
          <li key={v.version} className="space-y-1 border-b pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">v{v.version}</span>
              <span>{econModalityLabel[v.modality]}</span>
              <span className="text-muted-foreground">
                {when(v.at)} · {v.by ?? "—"}
              </span>
            </div>
            <p className="text-muted-foreground">Fonte: {v.source_reference}</p>
            {v.change_reason && <p>Motivo: {v.change_reason}</p>}
            <ul className="list-disc pl-5">
              {v.components.map((x, i) => (
                <li key={i}>
                  {econComponentLabel[x.type]}: {money(x.amount, v.currency)}
                  {x.type === "hourly" ? "/h" : ""}
                  {x.proration ? ` · ${econProrationLabel[x.proration]}` : ""} · vence em{" "}
                  {x.due_days} dias · {x.source_clause}
                </li>
              ))}
            </ul>
            <ul className="text-muted-foreground">
              {c.events
                .filter((e) => e.version === v.version)
                .map((e, i) => (
                  <li key={i}>
                    {econEventLabel[e.kind]} — {when(e.at)} · {e.by ?? "—"}: {e.reason}
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ol>
      {c.provisions.length > 0 && (
        <div className="space-y-1 text-sm">
          <h4 className="font-medium">Provisões gerenciais fechadas</h4>
          <ul>
            {c.provisions.map((p) => (
              <li key={p.id}>
                {econMonthLabel(p.period_from)} · revisão {p.revision}: {money(p.known, p.currency)}{" "}
                — {when(p.closed_at)} · {p.closed_by ?? "—"} · {p.reason}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Provisão é previsão de custo; não é título, exigibilidade nem pagamento.
          </p>
        </div>
      )}
    </FormSection>
  );
}
