// Editor de assinatura de e-mail: WYSIWYG (padrão) ou HTML bruto.
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Code2, Pencil } from "lucide-react";
import { saveEmailSignature } from "@/lib/email-accounts.functions";
import { RichHtmlEditor } from "@/components/rich-html-editor";
import { normalizeHtmlField } from "@/lib/html-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function EmailSignatureEditor({
  accountId,
  accountEmail,
  initialHtml,
}: {
  accountId: string;
  accountEmail: string;
  initialHtml: string | null;
}) {
  const qc = useQueryClient();
  const save = useServerFn(saveEmailSignature);
  const [mode, setMode] = useState<"wysiwyg" | "html">("wysiwyg");
  const [html, setHtml] = useState(initialHtml ?? "");

  useEffect(() => {
    setHtml(initialHtml ?? "");
  }, [initialHtml]);

  const mut = useMutation({
    mutationFn: () => save({ data: { id: accountId, signature_html: normalizeHtmlField(html) } }),
    onSuccess: () => {
      toast.success("Assinatura salva");
      qc.invalidateQueries({ queryKey: ["email_accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Assinatura</CardTitle>
        <CardDescription>
          Aplicada automaticamente ao compor e-mails com {accountEmail}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`sig-${accountId}`}>Conteúdo</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMode((m) => (m === "wysiwyg" ? "html" : "wysiwyg"))}
          >
            {mode === "wysiwyg" ? (
              <>
                <Code2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Editar HTML
              </>
            ) : (
              <>
                <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Editor visual
              </>
            )}
          </Button>
        </div>

        {mode === "wysiwyg" ? (
          <RichHtmlEditor
            value={html}
            onChange={setHtml}
            placeholder="Ex.: Nome, cargo, telefone…"
            minHeight={140}
          />
        ) : (
          <Textarea
            id={`sig-${accountId}`}
            rows={8}
            className="font-mono text-xs"
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder="<p><strong>Nome</strong><br/>Cargo · Telefone</p>"
          />
        )}

        <div className="rounded-md border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Pré-visualização</p>
          {html.trim() ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              // Conteúdo é sanitizado ao salvar e ao renderizar via normalizeHtmlField.
              dangerouslySetInnerHTML={{ __html: normalizeHtmlField(html) ?? "" }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma assinatura definida.</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setHtml("")} disabled={mut.isPending}>
            Limpar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Salvando…" : "Salvar assinatura"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
