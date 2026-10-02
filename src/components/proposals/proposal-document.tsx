// Documento da proposta (mesmo visual do documento da cotação). Componente
// puramente presentacional: recebe os dados prontos.
import { forwardRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { sanitizeHtml } from "@/components/rich-html-editor";
import { formatCurrency, formatDateTime } from "@/lib/crm";
import type { ProposalDocumentData } from "@/lib/proposals/proposal-document-types";

export const ProposalDocument = forwardRef<HTMLDivElement, { doc: ProposalDocumentData }>(
  function ProposalDocument({ doc }, ref) {
    const { proposal: p, items } = doc;
    const expired = !!p.expires_at && new Date(p.expires_at) < new Date();
    return (
      <Card ref={ref} className="print:shadow-none print:border-0">
        <CardContent className="space-y-6 p-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-2xl font-semibold">{p.title || "Proposta"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Versão {p.version}</p>
            </div>
            {doc.agent && <div className="text-right text-sm font-medium">{doc.agent}</div>}
          </div>

          <div className="grid grid-cols-1 gap-6 text-sm sm:grid-cols-2">
            <div>
              <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Para</div>
              {doc.company && <div className="font-medium">{doc.company}</div>}
              {doc.contact && <div>{doc.contact}</div>}
              {doc.contactEmail && <div className="text-muted-foreground">{doc.contactEmail}</div>}
            </div>
            <div>
              <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                Detalhes
              </div>
              <div>Emitida em {formatDateTime(p.created_at)}</div>
              {p.expires_at && (
                <div className={expired ? "text-destructive" : ""}>
                  Válida até {formatDateTime(p.expires_at)}
                </div>
              )}
            </div>
          </div>

          {items.length > 0 && (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3 text-left">Item</th>
                    <th className="p-3 text-left">Cobrança</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((li) => (
                    <tr key={li.id} className="border-t">
                      <td className="p-3">{li.name}</td>
                      <td className="p-3 tabular-nums text-muted-foreground">{li.billing}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {p.total_amount != null && (
            <div className="flex justify-end">
              <div className="flex w-64 justify-between border-t pt-1 text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(p.total_amount, p.currency)}</span>
              </div>
            </div>
          )}

          {p.body && (
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(p.body) }}
            />
          )}

          {p.status === "accepted" && p.decided_at && (
            <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-4 text-sm font-medium">
              Aceita em {formatDateTime(p.decided_at)}
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
);
