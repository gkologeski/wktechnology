import { useImportAccess } from "./use-import-access";
import { assertImportUiAccess } from "./import-access";
import type { ImportQueryScope } from "./import-format";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { JourneyRecordDetail } from "@/lib/projects/imports/import-journey";
import { getImportJourneyFile } from "@/lib/projects/imports/import-journey.functions";
import { count } from "./import-format";

export function ImportSourceFiles({
  record,
  scope,
}: {
  record: JourneyRecordDetail;
  scope: ImportQueryScope;
}) {
  const access = useImportAccess(scope);
  const getFile = useServerFn(getImportJourneyFile);
  const [loading, setLoading] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<{ id: string; url: string; name: string } | null>(null);
  if (!access.canRead(record.provider) || !record.files?.length) return null;
  async function download(fileId: string) {
    if (loading) return;
    // Reserve the window during the explicit user gesture; never reuse another application tab.
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    setLoading(fileId);
    setPrepared(null);
    try {
      assertImportUiAccess(access, record.provider);
      const result = await getFile({ data: { id: record.id, fileId } });
      if (new URL(result.url).protocol !== "https:")
        throw new Error("Endereço do arquivo indisponível.");
      if (popup) popup.location.replace(result.url);
      else setPrepared({ id: fileId, url: result.url, name: result.name });
    } catch (error) {
      popup?.close();
      toast.error(
        error instanceof Error ? error.message : "Não foi possível abrir o conteúdo preservado.",
      );
    } finally {
      setLoading(null);
    }
  }
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">Conteúdos preservados</h3>
      <ul className="divide-y divide-border-subtle">
        {record.files.map((file) => (
          <li key={file.id} className="py-3 first:pt-0">
            <div className="flex items-start gap-2.5">
              <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm">{file.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {file.size == null ? "Tamanho não informado" : `${count(file.size)} bytes`}
                </p>
                {file.issue && <p className="mt-1 text-xs text-destructive">{file.issue}</p>}
              </div>
              {file.status === "preserved" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={loading !== null}
                  onClick={() => void download(file.id)}
                  aria-label={`Baixar ${file.name}`}
                >
                  {loading === file.id ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Download aria-hidden />
                  )}
                  Baixar
                </Button>
              ) : (
                <Badge variant="outline">Conteúdo pendente</Badge>
              )}
            </div>
            {prepared?.id === file.id && (
              <a
                className="mt-2 inline-block text-xs text-primary underline"
                href={prepared.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir {prepared.name}
              </a>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs leading-relaxed text-muted-foreground">
        O acesso ao conteúdo é revalidado no servidor. Um arquivo pendente mantém sua identificação
        e a falha visível, sem ser contado como conteúdo preservado.
      </p>
    </section>
  );
}
