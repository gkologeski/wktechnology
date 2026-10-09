// Carrega corpo, anexos e rastreamento do e-mail só quando o item aparece na
// tela. A busca no servidor continua cobrindo o conteúdo completo; aqui só se
// evita transferir o corpo de todos os e-mails da página de uma vez.
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailTimelineItem } from "@/components/activity/email-timeline-item";
import type { EmailMeta } from "@/components/activity/timeline-shared";
import { fetchEmailDetail, type EmailDetail } from "@/lib/timeline/email-fetch";

export function LazyEmailTimelineItem({
  meta,
  createdAt,
  onOpenAttachment,
}: {
  meta: EmailMeta;
  createdAt: string | null;
  onOpenAttachment: (path: string | undefined) => void;
}) {
  const needsDetail = meta.detail_loaded === false && !!meta.message_id;
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(!needsDetail);
  const [detail, setDetail] = useState<EmailDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (visible || !ref.current) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!needsDetail || !visible || detail || !meta.message_id) return;
    let cancelled = false;
    setError(null);
    fetchEmailDetail(meta.message_id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Falha ao carregar o e-mail.");
      });
    return () => {
      cancelled = true;
    };
  }, [needsDetail, visible, detail, meta.message_id, attempt]);

  if (!needsDetail || detail) {
    return (
      <EmailTimelineItem
        meta={detail ? { ...meta, ...detail, detail_loaded: true } : meta}
        createdAt={createdAt}
        onOpenAttachment={onOpenAttachment}
      />
    );
  }

  return (
    <div
      ref={ref}
      className="mt-1 rounded-lg border border-border/60 bg-card p-3 text-xs text-muted-foreground"
      aria-live="polite"
    >
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-destructive">Não foi possível carregar o e-mail: {error}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Tentar novamente
          </Button>
        </div>
      ) : (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Carregando conteúdo do e-mail de {meta.from_name || meta.from_email || "remetente"}…
        </span>
      )}
    </div>
  );
}
