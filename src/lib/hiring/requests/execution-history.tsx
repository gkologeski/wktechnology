import type { RequestKind, PreparationRow } from "./types";
import { useExecution } from "./execution-panel";
import { FormSection } from "@/components/techhire/ui";

const fmt = (d: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "sem término";

/** Center column: immutable start record, engagement and allocations (read-only). */
export function ExecutionHistory({ kind, row }: { kind: RequestKind; row: PreparationRow }) {
  const { view, q } = useExecution(kind, row);
  if (!view || !q.data?.start) return null;
  const s = q.data.start;
  return (
    <FormSection title="Execução">
      <ol className="space-y-3 text-sm">
        <li className="border-b py-2">
          <strong>Início autorizado · revisão {s.revision}</strong>
          <p>
            Período: {fmt(s.starts_at)} a {fmt(s.ends_at)}
          </p>
          <p className="whitespace-pre-wrap break-words">{s.reason}</p>
          <p className="text-muted-foreground">
            {new Date(s.authorized_at).toLocaleString("pt-BR")} · {s.authorized_by_name ?? "Gestor"}
          </p>
        </li>
        {q.data.engagement && (
          <li className="border-b py-2">
            <strong>
              Vínculo direto ({q.data.engagement.status === "active" ? "ativo" : "encerrado"})
            </strong>
            <p>
              {fmt(q.data.engagement.starts_at)} a {fmt(q.data.engagement.ends_at)}
            </p>
          </li>
        )}
        {q.data.allocations.map((a) => (
          <li key={a.id} className="border-b py-2">
            <strong>Alocação · {a.project_name ?? "Sem projeto"}</strong>
            <p>
              {a.allocation_pct}% · {fmt(a.starts_at)} a {fmt(a.ends_at)}
            </p>
          </li>
        ))}
      </ol>
    </FormSection>
  );
}
