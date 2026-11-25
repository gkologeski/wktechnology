import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Loader2, Maximize2, RotateCcw } from "lucide-react";
import { sanitizeHtml } from "@/components/rich-html-editor";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { signProposalAssetUrls } from "@/lib/proposals/proposal-assets.functions";
import { collectVisualStoragePaths, type VisualDesign } from "@/lib/proposals/visual-design";
import {
  buildVisualReviewSrcDoc,
  mergeVisualPreviewContext,
  type VisualRenderContext,
} from "@/lib/proposals/visual-renderer";
import { VisualPreviewModal } from "./visual-editor/visual-preview-modal";

type ProposalReviewPreviewProps = {
  design: VisualDesign | null;
  body: string;
  context: VisualRenderContext;
  workspaceLogoUrl?: string | null;
  draftLabel?: string;
};

export function ProposalReviewPreview({
  design,
  body,
  context,
  workspaceLogoUrl = null,
  draftLabel,
}: ProposalReviewPreviewProps) {
  const { can } = usePermissions();
  const canSignAssets = ["own", "team", "workspace"].some(
    (s) => can(`techsales.proposal_templates.view.${s}`) || can(`techsales.proposals.view.${s}`),
  );
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const signFn = useServerFn(signProposalAssetUrls);

  const storagePaths = useMemo(() => (design ? collectVisualStoragePaths(design) : []), [design]);
  const pathsKey = storagePaths.join("|");

  const signQ = useQuery({
    queryKey: ["proposal-review-assets", pathsKey],
    enabled: Boolean(design) && canSignAssets && storagePaths.length > 0,
    queryFn: () => signFn({ data: { paths: storagePaths } }),
    retry: false,
  });

  useLayoutEffect(() => {
    if (!design) return;
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      setContainerWidth(w > 0 ? Math.round(w) : 760);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [design]);

  const signedUrls = useMemo(() => signQ.data ?? {}, [signQ.data]);
  const isSigning = Boolean(design) && storagePaths.length > 0 && signQ.isLoading;
  const hasSignError = Boolean(design) && storagePaths.length > 0 && signQ.isError;

  const mergedContext = useMemo(
    () =>
      design ? mergeVisualPreviewContext(context, design, signedUrls, workspaceLogoUrl) : context,
    [context, design, signedUrls, workspaceLogoUrl],
  );

  const srcDoc = useMemo(
    () =>
      design && !isSigning && !hasSignError && containerWidth != null
        ? buildVisualReviewSrcDoc(design, mergedContext, containerWidth)
        : "",
    [containerWidth, design, hasSignError, isSigning, mergedContext],
  );

  if (!design) {
    return (
      <div
        className="prose prose-sm max-h-64 max-w-none overflow-y-auto rounded-md border bg-muted/30 p-3 dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) }}
      />
    );
  }

  const pageCount = design.pages.length;
  const orientationLabel = design.orientation === "landscape" ? "Paisagem" : "Retrato";

  return (
    <div className="space-y-2" data-testid="proposal-review-visual">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Pré-visualização visual · {pageCount} {pageCount === 1 ? "página" : "páginas"} · A4{" "}
          {orientationLabel}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          disabled={isSigning || hasSignError}
          onClick={() => setFullscreenOpen(true)}
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          Ver em tela cheia
        </Button>
      </div>

      <div
        ref={containerRef}
        className="overflow-hidden rounded-md border border-border bg-muted/40"
      >
        {isSigning ? (
          <div
            role="status"
            className="flex h-[360px] items-center justify-center gap-2 text-sm text-muted-foreground sm:h-[460px]"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Carregando visualização da proposta...
          </div>
        ) : hasSignError ? (
          <div className="flex h-[320px] flex-col items-center justify-center gap-3 p-4 text-center">
            <Alert variant="destructive" className="max-w-md text-left">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>Não foi possível carregar as imagens desta proposta</AlertTitle>
              <AlertDescription className="mt-1 text-xs">
                {signQ.error instanceof Error
                  ? signQ.error.message
                  : "Ocorreu um erro ao preparar a visualização do modelo visual."}
              </AlertDescription>
            </Alert>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => void signQ.refetch()}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Tentar novamente
            </Button>
          </div>
        ) : containerWidth != null ? (
          <iframe
            key={containerWidth}
            sandbox=""
            title="Pré-visualização visual da proposta"
            srcDoc={srcDoc}
            className="block h-[360px] w-full border-0 bg-transparent sm:h-[460px]"
          />
        ) : null}
      </div>

      <VisualPreviewModal
        open={fullscreenOpen}
        onOpenChange={setFullscreenOpen}
        design={design}
        signedUrls={signedUrls}
        workspaceLogoUrl={workspaceLogoUrl}
        draftContext={context}
        {...(draftLabel ? { draftLabel } : {})}
      />
    </div>
  );
}
