import { cn } from "@/lib/utils";
import { esignBodyHtml } from "@/lib/esign/body-format";

/** Mostra o corpo do documento de assinatura: formatado (modelo) ou texto antigo. */
export function EsignBodyView({ body, className }: { body: string; className?: string }) {
  const html = esignBodyHtml(body);
  if (html === null) {
    return <div className={cn("whitespace-pre-wrap text-sm", className)}>{body}</div>;
  }
  return (
    <div
      className={cn("prose prose-sm max-w-none dark:prose-invert", className)}
      // HTML sanitizado por sanitizeTemplateHtml (lista fechada de tags/estilos).
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
