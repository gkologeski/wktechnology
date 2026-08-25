// Modal de visualização de documento anexado à ficha de pessoa (TechPeople).
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, ExternalLink, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getDocumentDownloadUrl, type PeopleDocumentRow } from "@/lib/people/documents.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  document: PeopleDocumentRow | null;
};

type Kind = "image" | "audio" | "video" | "pdf" | "office" | "text" | "other";

function kindOf(fileName: string): Kind {
  const n = (fileName || "").toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(n)) return "image";
  if (/\.(mp3|wav|m4a|ogg|oga|aac|flac|opus)$/i.test(n)) return "audio";
  if (/\.(mp4|webm|mov|m4v|ogv|mkv|avi)$/i.test(n)) return "video";
  if (/\.pdf$/i.test(n)) return "pdf";
  if (/\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf)$/i.test(n)) return "office";
  if (/\.(txt|md|csv|tsv|log|json|xml|yaml|yml|html?|css|js|ts|tsx|jsx|sql|sh)$/i.test(n))
    return "text";
  return "other";
}

function formatSize(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function PersonDocumentViewerDialog({ open, onOpenChange, document }: Props) {
  const downloadFn = useServerFn(getDocumentDownloadUrl);
  const [url, setUrl] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileName = document?.file_name ?? document?.doc_type ?? "Documento";
  const kind = document?.file_url ? kindOf(fileName) : "other";

  useEffect(() => {
    if (!open || !document?.file_url) {
      setUrl(null);
      setPdfBlobUrl(null);
      setPdfLoading(false);
      setPdfError(null);
      setTextPreview(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setUrl(null);
    setPdfBlobUrl(null);
    setPdfLoading(false);
    setPdfError(null);
    setTextPreview(null);
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { url: signed } = await downloadFn({ data: { id: document.id } });
        if (cancelled) return;
        setUrl(signed);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Falha ao carregar documento");
          toast.error(e instanceof Error ? e.message : "Falha ao carregar documento");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, document?.id, document?.file_url, downloadFn]);

  // PDF: baixa como Blob e renderiza somente blob: URL para evitar bloqueios/downloads do Chrome.
  useEffect(() => {
    if (!url || kind !== "pdf") {
      setPdfBlobUrl(null);
      setPdfLoading(false);
      setPdfError(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    setPdfBlobUrl(null);
    setPdfLoading(true);
    setPdfError(null);

    (async () => {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`Falha ao carregar PDF (HTTP ${r.status})`);
        const raw = await r.blob();
        const blob =
          raw.type === "application/pdf" ? raw : raw.slice(0, raw.size, "application/pdf");
        createdUrl = URL.createObjectURL(blob);
        if (!cancelled) setPdfBlobUrl(createdUrl);
        else if (createdUrl) URL.revokeObjectURL(createdUrl);
      } catch (e) {
        if (!cancelled) {
          setPdfError(e instanceof Error ? e.message : "Falha ao carregar PDF para visualização");
        }
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
      setPdfBlobUrl(null);
    };
  }, [url, kind]);

  // Texto: baixa e exibe conteúdo inline.
  useEffect(() => {
    if (!url || kind !== "text") return;
    let cancelled = false;

    (async () => {
      try {
        const r = await fetch(url);
        const txt = await r.text();
        if (!cancelled) setTextPreview(txt.slice(0, 20000));
      } catch {
        /* mantém botão de download como fallback */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, kind]);

  const handleDownload = () => {
    if (!url) return;
    const a = window.document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.click();
  };

  const header = (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{fileName}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {url && (
          <Button variant="ghost" size="sm" onClick={handleDownload}>
            <Download className="mr-1.5 h-4 w-4" />
            Baixar
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Fechar">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex h-96 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          Carregando documento…
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex h-96 flex-col items-center justify-center gap-3 px-6 text-center text-sm">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      );
    }

    if (!url) {
      return (
        <div className="flex h-96 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
          <FileText className="h-8 w-8" />
          Documento sem arquivo anexado.
        </div>
      );
    }

    if (kind === "image") {
      return (
        <div className="flex h-[70vh] items-center justify-center overflow-auto bg-muted/20 p-2">
          <img src={url} alt={fileName} className="max-h-full max-w-full object-contain" />
        </div>
      );
    }

    if (kind === "audio") {
      return (
        <div className="flex h-48 flex-col items-center justify-center gap-3 p-6">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <audio controls preload="metadata" className="w-full max-w-md">
            <source src={url} />
          </audio>
        </div>
      );
    }

    if (kind === "video") {
      return (
        <div className="flex h-[70vh] items-center justify-center bg-black p-2">
          <video controls preload="metadata" className="max-h-full max-w-full">
            <source src={url} />
          </video>
        </div>
      );
    }

    if (kind === "pdf") {
      if (pdfLoading || !pdfBlobUrl) {
        return (
          <div className="flex h-96 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
            {pdfError ? (
              <>
                <FileText className="h-8 w-8" />
                <p className="text-destructive">{pdfError}</p>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="mr-1.5 h-4 w-4" />
                  Baixar arquivo
                </Button>
              </>
            ) : (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                Preparando visualização do PDF…
              </>
            )}
          </div>
        );
      }

      return (
        <iframe
          src={`${pdfBlobUrl}#toolbar=1&navpanes=0`}
          title={fileName}
          className="h-[70vh] w-full bg-muted/20"
        />
      );
    }

    if (kind === "office") {
      const officeSrc = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
      return <iframe src={officeSrc} title={fileName} className="h-[70vh] w-full bg-muted/20" />;
    }

    if (kind === "text") {
      return (
        <pre className="h-[70vh] w-full overflow-auto whitespace-pre-wrap break-words bg-muted/10 p-4 text-xs leading-relaxed">
          {textPreview ?? "Carregando…"}
        </pre>
      );
    }

    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 px-6 text-center text-sm">
        <FileText className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">
          Este tipo de arquivo não pode ser visualizado diretamente.
        </p>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="mr-1.5 h-4 w-4" />
          Baixar arquivo
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Visualizar documento</DialogTitle>
          <DialogDescription>{fileName}</DialogDescription>
        </DialogHeader>
        {header}
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
