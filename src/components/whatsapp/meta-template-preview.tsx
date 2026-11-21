import { FileText, Image, Video } from "lucide-react";
import type { MetaTemplate, MetaTemplateDraft } from "@/lib/whatsapp/meta-template-types";

function withExamples(text: string, examples: Record<string, string>) {
  return text.replace(/\{\{\s*([a-zA-Z_][a-zA-Z_0-9]*|\d+)\s*\}\}/g, (full, key: string) =>
    Object.prototype.hasOwnProperty.call(examples, key) && typeof examples[key] === "string"
      ? examples[key].trim() || full
      : full,
  );
}

export function MetaTemplatePreview({ draft }: { draft: MetaTemplateDraft }) {
  const Media =
    draft.headerFormat === "VIDEO" ? Video : draft.headerFormat === "IMAGE" ? Image : FileText;
  const authentication = draft.category === "AUTHENTICATION";
  return (
    <section className="min-w-0 space-y-3" aria-label="Prévia do modelo Meta">
      <h3 className="text-sm font-semibold">Prévia com exemplos</h3>
      <div className="max-w-sm space-y-3 rounded-2xl bg-muted/50 p-5 text-sm">
        {authentication ? (
          <>
            <p>
              <strong>123456</strong> é seu código de verificação.
            </p>
            {draft.authentication.securityRecommendation && (
              <p>Por segurança, não compartilhe este código.</p>
            )}
            {draft.authentication.expiresMinutes && (
              <p className="text-xs text-muted-foreground">
                Este código expira em {draft.authentication.expiresMinutes} minutos.
              </p>
            )}
            <div className="border-t border-border pt-3 text-center font-medium text-primary">
              {draft.authentication.buttonText || "Copiar código"}
            </div>
          </>
        ) : (
          <>
            {draft.headerFormat === "TEXT" && draft.headerText && (
              <p className="whitespace-pre-wrap break-words font-semibold">
                {draft.headerText.replace(/\{\{[^}]+\}\}/g, (full) => draft.headerExample || full)}
              </p>
            )}
            {["IMAGE", "VIDEO", "DOCUMENT"].includes(draft.headerFormat) && (
              <div className="flex items-center gap-2 rounded-lg bg-background p-4 text-muted-foreground">
                <Media className="size-5" aria-hidden="true" />
                <span>
                  Amostra de{" "}
                  {draft.headerFormat === "IMAGE"
                    ? "imagem"
                    : draft.headerFormat === "VIDEO"
                      ? "vídeo"
                      : "documento"}
                  {draft.headerHandle ? " anexada" : " necessária"}
                </span>
              </div>
            )}
            <p className="whitespace-pre-wrap break-words">
              {withExamples(draft.body, draft.bodyExamples) ||
                "O corpo da mensagem aparecerá aqui."}
            </p>
            {draft.footer && (
              <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                {draft.footer}
              </p>
            )}
            {draft.buttons.length > 0 && (
              <div className="space-y-2 border-t border-border pt-3">
                {draft.buttons.map((button, index) => (
                  <div key={index} className="break-words text-center font-medium text-primary">
                    {button.text || "Texto do botão"}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <p className="max-w-sm text-xs text-muted-foreground">
        Prévia ilustrativa, sem envio.{" "}
        {authentication
          ? "A Meta define o texto final de autenticação conforme o idioma."
          : "Os exemplos servem para análise da Meta; use dados fictícios."}{" "}
        A aprovação e a categoria finais são definidas pela Meta.
      </p>
    </section>
  );
}

export function MetaTemplateDetails({ template }: { template: MetaTemplate }) {
  return (
    <div className="min-w-0 space-y-5">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {[
          ["Nome", template.name],
          ["Idioma", template.language],
          ["Categoria na Meta", template.category],
          ["Status na Meta", template.status],
          ["ID na Meta", template.id],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-all font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {template.rejectionReason && (
        <p role="status" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          Motivo informado pela Meta: {template.rejectionReason}
        </p>
      )}
      {template.draft ? (
        <MetaTemplatePreview draft={template.draft} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Este modelo usa componentes avançados. A central não altera esse formato. Confira os
          campos disponíveis abaixo e use o Gerenciador do WhatsApp da Meta para consultar ou editar
          todos os componentes.
        </p>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Componentes recebidos da Meta</summary>
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted/40 p-4 text-xs">
          {JSON.stringify(template.components, null, 2)}
        </pre>
      </details>
    </div>
  );
}
