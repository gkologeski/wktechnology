import { useEffect, useState } from "react";
import { Download, FileText, ExternalLink } from "lucide-react";
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

function kindOf(att: TimelineAttachment): "image" | "audio" | "video" | "pdf" | "other" {
  const t = (att.type || "").toLowerCase();
  const n = (att.name || "").toLowerCase();
  if (t.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(n)) return "image";
  if (t.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|oga|aac|flac)$/i.test(n)) return "audio";
  if (t.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogv)$/i.test(n)) return "video";
  if (t === "application/pdf" || /\.pdf$/i.test(n)) return "pdf";
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
  const [error, setError] = useState<string | null>(null);
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

  const header = (
    <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border/60 bg-muted/30">
      <div className="flex items-center gap-2 min-w-0 text-xs">
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="truncate font-medium">{attachment.name}</span>
        {attachment.size > 0 && (
          <span className="text-muted-foreground">· {formatSize(attachment.size)}</span>
        )}
      </div>
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

  if (kind === "image") {
    return (
      <div className="rounded-lg border border-border/60 overflow-hidden bg-card max-w-md">
        {header}
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={attachment.name}
            loading="lazy"
            className="block max-h-80 w-full object-contain bg-muted/20"
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
    return (
      <div className="rounded-lg border border-border/60 overflow-hidden bg-card max-w-md">
        {header}
        <iframe
          src={url}
          title={attachment.name}
          className="block w-full h-80 bg-muted/20"
        />
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
