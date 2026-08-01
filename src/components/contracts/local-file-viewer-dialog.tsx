// Visualizador do arquivo local escolhido na importação de contrato.
// Funciona antes do contrato existir no banco: usa um blob: URL do próprio File.
// PDF renderiza inline; .docx não é renderizável no navegador, então oferece
// download e, quando disponível, o texto já extraído.
import { useEffect, useState } from "react";
import { Download, FileText, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  file: File | null;
  /** Texto já extraído (usado como preview quando o formato não renderiza). */
  text?: string | null;
};

function isPdf(name: string) {
  return /\.pdf$/i.test(name);
}

export function LocalContractFileViewerDialog({ open, onOpenChange, file, text }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open || !file) {
      setUrl(null);
      setError(null);
      setLoading(false);
      return;
    }
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    try {
      objectUrl = URL.createObjectURL(file);
      setUrl(objectUrl);
    } catch {
      setError("Não foi possível abrir o arquivo selecionado.");
    } finally {
      setLoading(false);
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, file, attempt]);

  const name = file?.name ?? "Contrato";
  const pdf = file ? isPdf(name) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col gap-3">
        <DialogHeader className="pr-10">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{name}</span>
          </DialogTitle>
          <DialogDescription>
            Visualização do arquivo enviado. Fechar não altera os dados extraídos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          {url ? (
            <Button asChild variant="outline" size="sm">
              <a href={url} download={name}>
                <Download className="h-4 w-4 mr-1" /> Baixar arquivo
              </a>
            </Button>
          ) : null}
          {error ? (
            <Button variant="outline" size="sm" onClick={() => setAttempt((a) => a + 1)}>
              <RotateCcw className="h-4 w-4 mr-1" /> Tentar novamente
            </Button>
          ) : null}
        </div>

        <div className="flex-1 min-h-0 rounded-md border bg-muted/20 overflow-hidden">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando arquivo…
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center p-6 text-center text-sm text-destructive">
              {error}
            </div>
          ) : !file || !url ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Nenhum arquivo selecionado.
            </div>
          ) : pdf ? (
            <iframe src={url} title={name} className="h-full w-full border-0" />
          ) : text ? (
            <pre className="h-full w-full overflow-auto whitespace-pre-wrap p-4 text-xs leading-relaxed">
              {text}
            </pre>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 p-6 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Arquivos .docx não são exibidos pelo navegador. Baixe o arquivo para conferir
                o conteúdo original.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
