import { FileText, Download, FileX } from "lucide-react";
import { classifyMedia } from "@/lib/whatsapp-media";

type Props = {
  url: string;
  contentType?: string | null;
  filename?: string | null;
  className?: string;
};

export function WhatsAppMediaBubble({ url, contentType, filename, className }: Props) {
  if (url === "unavailable") {
    return (
      <span
        className={`inline-flex items-center gap-2 text-xs text-muted-foreground ${className ?? ""}`}
      >
        <FileX className="h-4 w-4" aria-hidden /> Arquivo indisponível no WhatsApp
      </span>
    );
  }
  const kind = classifyMedia(contentType, url.split("?")[0]);
  if (kind === "image") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className={className}>
        <img
          src={url}
          alt="Imagem enviada na conversa do WhatsApp"
          className="max-h-64 max-w-full rounded-md object-cover"
          loading="lazy"
        />
      </a>
    );
  }
  if (kind === "audio") {
    return (
      <audio controls className={`w-full max-w-xs ${className ?? ""}`}>
        <source src={url} type={contentType || undefined} />
      </audio>
    );
  }
  if (kind === "video") {
    return (
      <video controls className={`max-h-64 max-w-full rounded-md ${className ?? ""}`}>
        <source src={url} type={contentType || undefined} />
      </video>
    );
  }
  const Icon = kind === "pdf" ? FileText : Download;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={filename || undefined}
      className={`inline-flex max-w-full items-center gap-2 rounded-md border bg-background/40 px-2 py-1 text-xs hover:bg-background/70 ${
        className ?? ""
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">
        {filename || (kind === "pdf" ? "Abrir PDF" : "Baixar anexo")}
      </span>
    </a>
  );
}

/** Texto com links clicáveis. */
export function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer" className="underline">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
