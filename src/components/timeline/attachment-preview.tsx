import { useEffect, useState } from "react";
import { Download, FileText, ExternalLink, Maximize2, Minimize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type TimelineAttachment = {
  path: string;
  name: string;
  size: number;
  type: string;
  bucket?: string;
};

type Props = {
  attachment: TimelineAttachment;
  signRecording?: (path: string) => Promise<string>;
};

type Kind = "image" | "audio" | "video" | "pdf" | "office" | "text" | "other";

function kindOf(att: TimelineAttachment): Kind {
  const t = (att.type || "").toLowerCase();
  const n = (att.name || "").toLowerCase();
  if (t.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(n)) return "image";
  if (t.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|oga|aac|flac)$/i.test(n)) return "audio";
  if (t.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogv)$/i.test(n)) return "video";
  if (t === "application/pdf" || /\.pdf$/i.test(n)) return "pdf";
  if (/\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf)$/i.test(n)) return "office";
  if (
    t.startsWith("text/") ||
    /\.(txt|md|csv|tsv|log|json|xml|yaml|yml|html?|css|js|ts|tsx|jsx|sql|sh)$/i.test(n)
  )
    return "text";
  return "other";
}

function formatSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentPreview({ attachment, signRecording }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const kind = kindOf(attachment);
  const bucket = attachment.bucket || "notes-attachments";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (bucket === "meeting-recordings" && signRecording) {
          const signed = await signRecording(attachment.path);
          if (!cancelled) setUrl(signed);
          return;
        }
        const { data, error: e } = await supabase.storage
          .from(bucket)
          .createSignedUrl(attachment.path, 60 * 60);
        if (e) throw e;
        if (!cancelled) setUrl(data.signedUrl);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Falha ao carregar anexo");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachment.path, bucket, signRecording]);

  // Pré-visualização de texto: baixa e exibe o conteúdo inline (limitado).
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

  // PDF: baixa como Blob e renderiza via object URL para contornar
  // Content-Disposition: attachment das signed URLs do Storage.
  useEffect(() => {
    if (!url || kind !== "pdf") return;
    let cancelled = false;
    let createdUrl: string | null = null;
    (async () => {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const raw = await r.blob();
        const blob =
          raw.type === "application/pdf" ? raw : raw.slice(0, raw.size, "application/pdf");
        createdUrl = URL.createObjectURL(blob);
        if (!cancelled) setPdfBlobUrl(createdUrl);
        else URL.revokeObjectURL(createdUrl);
      } catch {
        /* fallback: usa a signed URL diretamente no iframe */
      }
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
      setPdfBlobUrl(null);
    };
  }, [url, kind]);

  const canExpand = kind === "pdf" || kind === "office" || kind === "image" || kind === "text";

  const header = (
    <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border/60 bg-muted/30">
      <div className="flex items-center gap-2 min-w-0 text-xs">
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="truncate font-medium">{attachment.name}</span>
        {attachment.size > 0 && (
          <span className="text-muted-foreground">· {formatSize(attachment.size)}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            aria-label={expanded ? "Reduzir" : "Expandir"}
          >
            {expanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            {expanded ? "Reduzir" : "Expandir"}
          </button>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            download={attachment.name}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Download className="h-3 w-3" /> Baixar
          </a>
        )}
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
        {attachment.name}: {error}
      </div>
    );
  }

  if (!url) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground animate-pulse">
        Carregando {attachment.name}…
      </div>
    );
  }

  const wrapMax = expanded ? "max-w-3xl" : "w-full";
  const frameH = expanded ? "h-[80vh]" : "h-96";

  if (kind === "image") {
    return (
      <div className={`rounded-lg border border-border/60 overflow-hidden bg-card ${wrapMax}`}>
        {header}
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={attachment.name}
            loading="lazy"
            className={`block w-full object-contain bg-muted/20 ${expanded ? "max-h-[80vh]" : "max-h-80"}`}
          />
        </a>
      </div>
    );
  }

  if (kind === "audio") {
    return (
      <div className="rounded-lg border border-border/60 overflow-hidden bg-card max-w-md">
        {header}
        <div className="p-2">
          <audio controls preload="metadata" className="w-full">
            <source src={url} type={attachment.type || undefined} />
          </audio>
        </div>
      </div>
    );
  }

  if (kind === "video") {
    return (
      <div className="rounded-lg border border-border/60 overflow-hidden bg-card max-w-md">
        {header}
        <video controls preload="metadata" className="block max-h-80 w-full bg-black">
          <source src={url} type={attachment.type || undefined} />
        </video>
      </div>
    );
  }

  if (kind === "pdf") {
    const pdfSrc = pdfBlobUrl ?? url;
    return (
      <div className={`rounded-lg border border-border/60 overflow-hidden bg-card ${wrapMax}`}>
        {header}
        <iframe
          src={`${pdfSrc}#toolbar=1&navpanes=0`}
          title={attachment.name}
          className={`block w-full bg-muted/20 ${frameH}`}
        />
      </div>
    );
  }

  if (kind === "office") {
    // Visualizador embedado do Office Online (renderiza .docx/.xlsx/.pptx).
    // Requer URL pública acessível — signed URL do Supabase atende.
    const officeSrc = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    return (
      <div className={`rounded-lg border border-border/60 overflow-hidden bg-card ${wrapMax}`}>
        {header}
        <iframe
          src={officeSrc}
          title={attachment.name}
          className={`block w-full bg-muted/20 ${frameH}`}
        />
      </div>
    );
  }

  if (kind === "text") {
    return (
      <div className={`rounded-lg border border-border/60 overflow-hidden bg-card ${wrapMax}`}>
        {header}
        <pre
          className={`m-0 p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-words overflow-auto bg-muted/10 ${expanded ? "max-h-[80vh]" : "max-h-80"}`}
        >
          {textPreview ?? "Carregando…"}
        </pre>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={attachment.name}
      className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs hover:bg-muted"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      <span className="font-medium">{attachment.name}</span>
      {attachment.size > 0 && (
        <span className="text-muted-foreground">· {formatSize(attachment.size)}</span>
      )}
    </a>
  );
}
