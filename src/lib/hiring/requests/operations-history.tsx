import { useEffect, useRef } from "react";
import { NotificationTargetNotice } from "@/components/notifications/notification-target-notice";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/techhire/ui";
import { Badge } from "@/components/ui/badge";
import { downloadFiscalDocument } from "./operations.functions";
import { useOperations } from "./operations-panel";
import {
  deliveryStatusLabel,
  fiscalStatusLabel,
  fiscalTypeLabel,
  formatTaxId,
  modalityLabel,
  type OpsFiscal,
} from "./operations-types";
import type { RequestKind, PreparationRow } from "./types";

const fmt = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "—");
const when = (d: string) => new Date(d).toLocaleString("pt-BR");
const eventLabel = {
  version: "Versão",
  submission: "Submissão",
  accepted: "Aceite",
  rejected: "Rejeição",
} as const;

/** Center column: delivery versions/submissions/decisions and the private fiscal trail (read-only). */
export function OperationsHistory({
  kind,
  row,
  fiscalDocumentId,
}: {
  kind: RequestKind;
  row: PreparationRow;
  fiscalDocumentId?: string;
}) {
  const { view, q, revalidating } = useOperations(kind, row);
  if (!view) return null;
  const d = q.data;
  const focused =
    !revalidating && d?.can_view_fiscal
      ? d.fiscal?.find(
          (doc) => doc.id === fiscalDocumentId && ["nfse", "nfe"].includes(doc.doc_type),
        )
      : undefined;
  if (!d?.started)
    return fiscalDocumentId ? (
      <NotificationTargetNotice
        focusOnUnavailable
        label="NF de contratação do aviso"
        targetId={fiscalDocumentId}
        loading={revalidating}
        failed={q.isError}
        available={false}
        retry={
          <Button variant="outline" onClick={() => void q.refetch()}>
            Tentar novamente
          </Button>
        }
      >
        {null}
      </NotificationTargetNotice>
    ) : null;
  return (
    <FormSection title="Entregas e documentos fiscais">
      {fiscalDocumentId && (
        <NotificationTargetNotice
          focusOnUnavailable
          label="NF de contratação do aviso"
          targetId={fiscalDocumentId}
          loading={revalidating}
          failed={q.isError || !d.can_view_fiscal}
          available={!!focused}
          retry={
            <Button variant="outline" onClick={() => void q.refetch()}>
              Tentar novamente
            </Button>
          }
        >
          <p>
            Documento fiscal exato localizado. Abrir o aviso não baixa, confere, aceita ou paga a
            nota.
          </p>
        </NotificationTargetNotice>
      )}
      {revalidating && !fiscalDocumentId && (
        <p role="status">Conferindo acesso aos documentos fiscais…</p>
      )}
      <fieldset
        className="contents"
        disabled={revalidating}
        hidden={revalidating}
        inert={revalidating || undefined}
        style={revalidating ? { display: "none" } : undefined}
      >
        {d.deliveries.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma entrega registrada.</p>
        )}
        <ol className="space-y-4 text-sm">
          {d.deliveries.map((x) => (
            <li key={x.id} className="space-y-1 border-b pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <strong>{x.current.title}</strong>
                <Badge
                  variant={
                    x.status === "accepted"
                      ? "secondary"
                      : x.status === "rejected"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {deliveryStatusLabel[x.status]}
                </Badge>
                <span className="text-muted-foreground">v{x.version}</span>
              </div>
              <p className="whitespace-pre-wrap break-words">{x.current.criteria}</p>
              <p className="text-muted-foreground">
                {fmt(x.current.period_start)} a {fmt(x.current.period_end)} · Responsável:{" "}
                {x.current.responsible_name ?? "—"}
                {x.current.project_name ? ` · Projeto: ${x.current.project_name}` : ""}
              </p>
              <ol className="ml-3 space-y-1 border-l pl-3">
                {x.history.map((h, i) => (
                  <li key={i}>
                    <span className="font-medium">
                      {eventLabel[h.type]} v{h.version}
                    </span>{" "}
                    · {when(h.at)} · {h.by ?? "—"}
                    <p className="whitespace-pre-wrap break-words text-muted-foreground">
                      {h.text}
                    </p>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
        {d.fiscal === null ? (
          <p className="text-sm text-muted-foreground">
            Documentos fiscais visíveis apenas com permissão específica.
          </p>
        ) : d.fiscal.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum documento fiscal registrado.</p>
        ) : (
          <ol className="space-y-3 text-sm">
            {d.fiscal.map((f) => (
              <FiscalItem
                key={f.id}
                kind={kind}
                row={row}
                doc={f}
                focused={f.id === focused?.id}
                revalidating={revalidating}
              />
            ))}
          </ol>
        )}
      </fieldset>
    </FormSection>
  );
}

function FiscalItem({
  kind,
  row,
  doc,
  focused,
  revalidating,
}: {
  kind: RequestKind;
  row: PreparationRow;
  doc: OpsFiscal;
  focused: boolean;
  revalidating: boolean;
}) {
  const node = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (focused && !revalidating) {
      node.current?.scrollIntoView?.({ block: "nearest" });
    }
  }, [focused, revalidating]);
  const dl = useServerFn(downloadFiscalDocument);
  const m = useMutation({
    mutationFn: () => {
      if (revalidating) throw new Error("Aguarde a conferência de acesso.");
      return dl({ data: { kind, id: row.id, documentId: doc.id } });
    },
    onSuccess: (r) => {
      const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: r.mimeType }));
      const a = document.createElement("a");
      a.href = url;
      a.download = r.fileName;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
  return (
    <li
      ref={node}
      aria-current={focused ? "true" : undefined}
      className={`space-y-1 border-b pb-3 ${focused ? "rounded-md bg-accent p-3" : ""}`}
    >
      {focused && <Badge variant="outline">NF do aviso</Badge>}
      <div className="flex flex-wrap items-center gap-2">
        <strong>
          {fiscalTypeLabel[doc.doc_type]}
          {doc.modality ? ` (${modalityLabel[doc.modality]})` : ""} · {doc.document_number}
        </strong>
        <Badge
          variant={
            doc.status === "verified"
              ? "secondary"
              : doc.status === "rejected"
                ? "destructive"
                : "outline"
          }
        >
          {fiscalStatusLabel[doc.status]}
        </Badge>
      </div>
      <p>
        Emitente {formatTaxId(doc.issuer_tax_id)} · Tomador {formatTaxId(doc.taker_tax_id)} ·{" "}
        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: doc.currency }).format(
          doc.amount,
        )}{" "}
        · emitido em {fmt(doc.issued_on)}
      </p>
      <p className="break-all text-xs text-muted-foreground">
        {doc.file_name} · SHA-256 {doc.sha256} · enviado por {doc.uploaded_by_name ?? "—"} em{" "}
        {when(doc.registered_at)}
      </p>
      {doc.review && (
        <p className="text-muted-foreground">
          {doc.review.decision === "verified" ? "Conferido" : "Rejeitado"} por{" "}
          {doc.review.by ?? "—"} em {when(doc.review.at)}: {doc.review.reason}
        </p>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={m.isPending || revalidating}
        onClick={() => m.mutate()}
      >
        {m.isPending ? "Baixando…" : "Baixar arquivo"}
      </Button>
      {m.isError && (
        <p role="alert" className="text-destructive">
          {m.error.message}
        </p>
      )}
    </li>
  );
}
