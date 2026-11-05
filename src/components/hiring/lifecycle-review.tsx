import type { LifecycleChange } from "@/lib/hiring/lifecycle.functions";
/** Read-only business summary. The database compares the full opaque snapshot. */
export function LifecycleReview({
  snapshot,
  payload,
}: {
  snapshot: string;
  payload: LifecycleChange["payload"];
}) {
  const value = JSON.parse(snapshot) as {
    summary: {
      person: string;
      project: string | null;
      entity: string;
      replacement_person: string | null;
    };
    engagement: { starts_at: string; ends_at: string | null };
    allocation: { starts_at?: string; ends_at?: string } | null;
    financial: Array<{
      id: string;
      amount: number;
      currency: string;
      competence_date: string;
    }> | null;
  };
  const date = (text: string | null | undefined) =>
    text ? text.split("-").reverse().join("/") : "Sem fim definido";
  return (
    <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
      <dt className="text-muted-foreground">Profissional / entidade WK</dt>
      <dd>
        {value.summary.person} · {value.summary.entity}
      </dd>
      {value.summary.project && (
        <>
          <dt className="text-muted-foreground">Projeto da alocação</dt>
          <dd>{value.summary.project}</dd>
        </>
      )}
      <dt className="text-muted-foreground">Vigência atual do vínculo</dt>
      <dd>
        {date(value.engagement.starts_at)} a {date(value.engagement.ends_at)}
      </dd>
      {value.allocation?.starts_at && (
        <>
          <dt className="text-muted-foreground">Período da alocação selecionada</dt>
          <dd>
            {date(value.allocation.starts_at)} a {date(value.allocation.ends_at)}
          </dd>
        </>
      )}
      <dt className="text-muted-foreground">Data efetiva solicitada</dt>
      <dd>{date(payload.date)}</dd>
      {payload.start && (
        <>
          <dt className="text-muted-foreground">Início do substituto</dt>
          <dd>{date(payload.start)}</dd>
        </>
      )}
      {payload.end && (
        <>
          <dt className="text-muted-foreground">Fim do novo período</dt>
          <dd>{date(payload.end)}</dd>
        </>
      )}
      {payload.replacement && (
        <>
          <dt className="text-muted-foreground">Vínculo substituto selecionado</dt>
          <dd className="break-all">
            {value.summary.replacement_person ?? payload.replacement}
            {payload.overlap ? " · Sobreposição solicitada" : ""}
          </dd>
        </>
      )}
      {value.financial?.map((f) => (
        <div key={f.id} className="col-span-full rounded border p-2">
          Competência {date(f.competence_date)} · {f.currency}{" "}
          {Number(f.amount).toLocaleString("pt-BR")} · {f.id}
        </div>
      ))}
    </dl>
  );
}
