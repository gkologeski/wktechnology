import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useSharedAction } from "@/lib/access-control/use-shared-action";
import { actFormalization, getFormalization } from "./formalization.functions";
import { formalizationLabels } from "./formalization-types";
import { resourceFor, type RequestKind, type PreparationRow } from "./types";
export function FormalizationPanel({
  kind,
  row,
  dirty,
  busy,
}: {
  kind: RequestKind;
  row: PreparationRow;
  dirty: boolean;
  busy: boolean;
}) {
  const p = usePermissions(),
    qc = useQueryClient(),
    view = useSharedAction(resourceFor(kind), "view");
  const get = useServerFn(getFormalization),
    act = useServerFn(actFormalization);
  const [note, setNote] = useState(""),
    [link, setLink] = useState("");
  const input = { kind, id: row.id, revision: row.revision };
  const q = useQuery({
    queryKey: ["hiring-formalization", p.workspaceId, row.id, row.revision],
    enabled: view,
    queryFn: () => get({ data: input }),
    retry: false,
  });
  const m = useMutation({
    mutationFn: (
      action: "prepare" | "submit" | "legal" | "finance" | "link" | "revoke" | "reject",
    ) => act({ data: { ...input, action, note } }),
    onSuccess: (r, action) => {
      if (action === "link") setLink(`${window.location.origin}/minuta/${r.result}`);
      else setLink("");
      void qc.invalidateQueries({ queryKey: ["hiring-formalization"] });
    },
  });
  if (!view) return null;
  if (q.isLoading) return <p role="status">Carregando formalização…</p>;
  if (q.isError)
    return (
      <div role="alert">
        Formalização indisponível.
        <Button variant="outline" onClick={() => void q.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  const d = q.data;
  if (!d) return null;
  const locked = dirty || busy || m.isPending || q.isFetching;
  return (
    <section className="space-y-3 text-sm" aria-label="Formalização">
      <h3 className="font-semibold">{formalizationLabels[d.status]}</h3>
      {d.notes?.length > 0 && (
        <section aria-label="Trilha privada de conferência" className="space-y-2">
          <h4 className="font-medium">Trilha privada de conferência</h4>
          {d.notes.map((n) => (
            <div key={n.id} className="border-l pl-3">
              <p className="text-xs text-muted-foreground">
                {n.actor_label} · {new Date(n.created_at).toLocaleString("pt-BR")} · Ciclo {n.cycle}{" "}
                ·{" "}
                {(
                  {
                    submit: "Encaminhamento",
                    legal: "Jurídico",
                    finance: "Financeiro",
                    counterparty_changes: "Ajustes da contraparte",
                    legal_reject: "Rejeição jurídica",
                    finance_reject: "Rejeição Financeiro",
                  } as Record<string, string>
                )[n.stage] ?? n.stage}
              </p>
              <p className="whitespace-pre-wrap break-words">{n.note}</p>
            </div>
          ))}
        </section>
      )}
      {d.problem && <p role="status">{d.problem}</p>}
      <p>Jurídico: {d.legal_name ?? "Não configurado"}</p>
      <p>Financeiro: {d.finance_name ?? "Não configurado"}</p>
      <p>Assinatura: {d.signature_name ?? "Não configurado"}</p>
      {d.due_at && <p>Prazo: {new Date(d.due_at).toLocaleString("pt-BR")}</p>}
      {d.contract_id && (
        <Button asChild variant="outline">
          <Link to="/contracts/$id" params={{ id: d.contract_id }}>
            Abrir instrumento e anexos
          </Link>
        </Button>
      )}
      {d.draft_id && (
        <Button asChild variant="outline">
          <Link to="/contracts/drafts/$id" params={{ id: d.draft_id }}>
            Abrir minuta
          </Link>
        </Button>
      )}
      <Label htmlFor={`formal-note-${row.id}`}>
        Conferência de cláusulas, partes, condições e anexos / motivo
      </Label>
      <Textarea
        id={`formal-note-${row.id}`}
        value={note}
        maxLength={2000}
        disabled={locked}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {(d.can_legal || d.can_finance) && (
          <Button
            variant="destructive"
            disabled={locked || note.trim().length < 5}
            onClick={() => m.mutate("reject")}
          >
            Rejeitar revisão
          </Button>
        )}
        {d.can_prepare && (
          <Button disabled={locked} onClick={() => m.mutate("prepare")}>
            Preparar instrumento
          </Button>
        )}
        {d.can_submit && (
          <Button disabled={locked || note.trim().length < 5} onClick={() => m.mutate("submit")}>
            Encaminhar ao Jurídico
          </Button>
        )}
        {d.can_legal && (
          <Button disabled={locked || note.trim().length < 5} onClick={() => m.mutate("legal")}>
            Confirmar revisão jurídica
          </Button>
        )}
        {d.can_finance && (
          <Button disabled={locked || note.trim().length < 5} onClick={() => m.mutate("finance")}>
            Confirmar conferência Financeiro
          </Button>
        )}
        {d.can_link && (
          <Button disabled={locked} onClick={() => m.mutate("link")}>
            Gerar link de aceite
          </Button>
        )}
        {d.can_link && (
          <Button variant="outline" disabled={locked} onClick={() => m.mutate("revoke")}>
            Revogar versão
          </Button>
        )}
      </div>
      {link && (
        <div className="break-all">
          <a href={link} target="_blank" rel="noreferrer">
            {link}
          </a>
        </div>
      )}
      {m.isError && (
        <p role="alert" className="text-destructive">
          {m.error.message}
        </p>
      )}
      {m.isPending && <p role="status">Registrando…</p>}
    </section>
  );
}
