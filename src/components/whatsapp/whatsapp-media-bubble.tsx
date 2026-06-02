import { FileText, Download } from "lucide-react";
import { classifyMedia } from "@/lib/whatsapp-media";

type Props = {
  url: string;
  contentType?: string | null;
  className?: string;
};

export function WhatsAppMediaBubble({ url, contentType, className }: Props) {
  const kind = classifyMedia(contentType, url);
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
  if (kind === "pdf") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={`inline-flex items-center gap-2 rounded-md border bg-background/40 px-2 py-1 text-xs ${
          className ?? ""
        }`}
      >
        <FileText className="h-4 w-4" /> Abrir PDF
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-2 rounded-md border bg-background/40 px-2 py-1 text-xs ${
        className ?? ""
      }`}
    >
      <Download className="h-4 w-4" /> Anexo
    </a>
  );
}
