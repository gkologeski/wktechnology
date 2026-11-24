// Condições vigentes: contrato original consolidado com os aditivos ativos.
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/crm";
import type { effectiveTerms, TermField } from "@/lib/contracts/effective-terms";

type Effective = ReturnType<typeof effectiveTerms>;
const LABEL: Record<TermField, string> = {
  starts_at: "Início",
  ends_at: "Fim",
  monthly_value: "Valor mensal",
  hours_per_month: "Horas por mês",
  notice_days: "Aviso prévio (dias)",
  service_scope: "Escopo",
};
const date = (v: unknown) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—");

export function EffectiveTermsCard({
  effective,
  original,
  amendments,
  currency,
}: {
  effective: Effective;
  original: { starts_at: string | null; ends_at: string | null; total_value: number };
  amendments: { id: string; number: string | null; title: string }[];
  currency: string;
}) {
  const fmt = (f: TermField, v: unknown) =>
    v == null ? "—" : f === "starts_at" || f === "ends_at" ? date(v) : f === "monthly_value" ? formatCurrency(Number(v), currency) : String(v);
  const nameOf = (id: string) => amendments.find((a) => a.id === id);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Condições vigentes (com aditivos)</CardTitle>
        <p className="text-xs text-muted-foreground">
          Os aditivos ativos prevalecem sobre o contrato original quando informam algo diferente,
          inclusive prazo menor. Valor e horas somam o pacote de cada aditivo.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <dl className="grid gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Vigência</dt>
            <dd className="font-medium">{date(effective.starts_at)} → {date(effective.ends_at)}</dd>
            {effective.ends_at !== (original.ends_at?.slice(0, 10) ?? null) && (
              <dd className="text-xs text-muted-foreground">Original: {date(original.ends_at)}</dd>
            )}
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Valor total acumulado</dt>
            <dd className="font-medium">{formatCurrency(effective.total_value, currency)}</dd>
            <dd className="text-xs text-muted-foreground">Original: {formatCurrency(original.total_value, currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Horas contratadas</dt>
            <dd className="font-medium">{effective.contracted_hours != null ? `${effective.contracted_hours} h` : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Aditivos considerados</dt>
            <dd className="font-medium">{effective.applied.length}</dd>
          </div>
        </dl>
        {effective.changes.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {effective.changes.map((c, i) => {
              const a = nameOf(c.amendmentId);
              return (
                <li key={i} className="flex flex-wrap items-center gap-x-2 px-3 py-2">
                  <span className="font-medium">{LABEL[c.field]}:</span>
                  <span className="text-muted-foreground line-clamp-1 max-w-[40%]">{fmt(c.field, c.from)}</span>
                  <span aria-hidden>→</span>
                  <span className="line-clamp-1 max-w-[40%]">{fmt(c.field, c.to)}</span>
                  <Link to="/contracts/$id" params={{ id: c.amendmentId }} className="ml-auto text-xs text-primary hover:underline">
                    {a?.number ?? a?.title ?? "Aditivo"}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
