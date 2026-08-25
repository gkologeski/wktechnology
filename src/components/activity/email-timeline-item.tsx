import { useEffect, useState, useRef, useMemo } from "react";
import { sanitizeHtml as sanitizeEmailHtml } from "@/components/rich-html-editor";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDateTime } from "@/lib/crm";
import type { Activity } from "@/lib/db-types";
import { Paperclip, Download, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eye, MousePointerClick } from "lucide-react";
import {
  type EmailMeta,
  attachmentIcon,
  colorFromString,
  escapeHtmlText,
  formatBytes,
  initialsFromEmail,
} from "./timeline-shared";

export function EmailTimelineItem({
  meta,
  createdAt,
  onOpenAttachment,
}: {
  meta: EmailMeta;
  createdAt: string | null;
  onOpenAttachment: (path: string | undefined) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeHeight, setIframeHeight] = useState<number>(160);
  const [collapsed, setCollapsed] = useState<boolean>(true);
  const [headerOpen, setHeaderOpen] = useState<boolean>(false);

  const isOut = meta.direction === "outbound";
  const displayName = isOut
    ? meta.from_name || meta.from_email || "Você"
    : meta.from_name || meta.from_email || "Remetente";
  const displayEmail = meta.from_email ?? "";
  const dateStr = createdAt ? formatDateTime(meta.sent_at || meta.received_at || createdAt) : "";
  const toList = meta.to_emails ?? [];
  const primaryTo = toList[0] ?? "—";
  const extraToCount = Math.max(0, toList.length - 1);

  const srcDoc = useMemo(() => {
    const rawHtml = meta.body_html?.trim();
    const rawText = meta.body_text?.trim();
    let inner = "";
    if (rawHtml) {
      inner = sanitizeEmailHtml(rawHtml);
    } else if (rawText) {
      inner = `<div style="white-space:pre-wrap">${escapeHtmlText(rawText)}</div>`;
    } else {
      inner = `<p style="color:#888">(sem conteúdo)</p>`;
    }
    return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>
      html,body{margin:0;padding:12px;background:transparent;color:#111;font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;word-wrap:break-word;overflow-wrap:anywhere}
      @media (prefers-color-scheme: dark){html,body{color:#e5e7eb}}
      img,video,table{max-width:100%!important;height:auto}
      table{border-collapse:collapse}
      a{color:#2563eb}
      blockquote{border-left:3px solid #e5e7eb;margin:8px 0;padding:2px 10px;color:#6b7280}
      pre,code{white-space:pre-wrap;word-break:break-word}
    </style></head><body>${inner}</body></html>`;
  }, [meta.body_html, meta.body_text]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let raf = 0;
    const measure = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        const h = Math.min(2400, Math.max(80, doc.documentElement.scrollHeight));
        setIframeHeight(h);
        setCollapsed(h > 460);
      } catch {
        /* cross-origin — srcDoc should be same-origin sandbox */
      }
    };
    const onLoad = () => {
      measure();
      raf = window.setTimeout(measure, 120) as unknown as number;
    };
    iframe.addEventListener("load", onLoad);
    return () => {
      iframe.removeEventListener("load", onLoad);
      if (raf) window.clearTimeout(raf);
    };
  }, [srcDoc]);

  const maxH = collapsed ? 460 : iframeHeight + 8;

  return (
    <div className="mt-1 rounded-lg border border-border/60 bg-card">
      {/* Header */}
      <div className="flex items-start gap-3 p-3 pb-2">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback
            className="text-xs font-medium text-white"
            style={{ backgroundColor: colorFromString(displayEmail || displayName) }}
          >
            {initialsFromEmail(meta.from_name, meta.from_email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm">
                <span className="font-semibold text-foreground">{displayName}</span>
                {displayEmail && displayEmail !== displayName && (
                  <span className="ml-1 text-muted-foreground">&lt;{displayEmail}&gt;</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setHeaderOpen((v) => !v)}
                className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <span className="truncate">
                  para {primaryTo}
                  {extraToCount > 0 ? `, +${extraToCount}` : ""}
                </span>
                <ChevronDown
                  className={cn("h-3 w-3 transition-transform", headerOpen && "rotate-180")}
                />
              </button>
              {headerOpen && (
                <div className="mt-1 space-y-0.5 rounded-md border border-border/50 bg-muted/30 p-2 text-[11px] text-muted-foreground">
                  <div>
                    <span className="text-foreground/70">De: </span>
                    {meta.from_name
                      ? `${meta.from_name} <${meta.from_email ?? ""}>`
                      : (meta.from_email ?? "—")}
                  </div>
                  <div>
                    <span className="text-foreground/70">Para: </span>
                    {toList.join(", ") || "—"}
                  </div>
                  {meta.cc_emails.length > 0 && (
                    <div>
                      <span className="text-foreground/70">Cc: </span>
                      {meta.cc_emails.join(", ")}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
              {meta.has_attachments && <Paperclip className="h-3.5 w-3.5" />}
              <span>{dateStr}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="relative border-t border-border/60">
        <div
          className="overflow-hidden transition-[max-height] duration-200"
          style={{ maxHeight: maxH }}
        >
          <iframe
            ref={iframeRef}
            title="E-mail"
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            srcDoc={srcDoc}
            className="w-full border-0"
            style={{ height: iframeHeight }}
          />
        </div>
        {iframeHeight > 460 && (
          <>
            {collapsed && (
              <div className="pointer-events-none absolute inset-x-0 bottom-8 h-10 bg-gradient-to-t from-card to-transparent" />
            )}
            <div className="flex justify-center border-t border-border/60 bg-muted/30">
              <button
                type="button"
                onClick={() => setCollapsed((v) => !v)}
                className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                {collapsed ? "Ver mensagem completa" : "Recolher"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Attachments */}
      {meta.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border/60 p-3">
          {meta.attachments.map((att, i) => {
            const Icon = attachmentIcon(att.filename, att.content_type);
            return (
              <button
                key={i}
                type="button"
                onClick={() => onOpenAttachment(att.path)}
                disabled={!att.path}
                title={att.path ? "Baixar anexo" : "Anexo indisponível"}
                className="group flex w-[260px] items-center gap-2.5 rounded-md border border-border/60 bg-muted/30 p-2 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-foreground">{att.filename}</div>
                  {att.size ? (
                    <div className="text-[11px] text-muted-foreground">{formatBytes(att.size)}</div>
                  ) : null}
                </div>
                <Download className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      )}

      {/* Metrics (outbound only) */}
      {isOut && (meta.open_count > 0 || meta.click_count > 0) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {meta.open_count} abertura{meta.open_count === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1">
            <MousePointerClick className="h-3 w-3" />
            {meta.click_count} clique{meta.click_count === 1 ? "" : "s"}
          </span>
          {meta.last_opened_at && (
            <span>Última abertura em {formatDateTime(meta.last_opened_at)}</span>
          )}
          {meta.last_clicked_at && (
            <span className="truncate">
              Último clique em {formatDateTime(meta.last_clicked_at)}
              {meta.last_clicked_url ? ` · ${meta.last_clicked_url}` : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
