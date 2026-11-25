import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Eye,
  Maximize2,
  Minimize2,
  PanelLeft,
  PanelRight,
  Redo2,
  Ruler,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  createProposalAssetUpload,
  listBrandKitContext,
  signProposalAssetUrls,
} from "@/lib/proposals/proposal-assets.functions";
import {
  VISUAL_MAX_PAGES,
  collectVisualStoragePaths,
  createDefaultElement,
  pageSizeMm,
  uid,
  type VisualBrandKit,
  type VisualDesign,
  type VisualElement,
} from "@/lib/proposals/visual-design";
import { VisualCanvas } from "./visual-canvas";
import {
  alignSelectedElements,
  cloneElementsWithOffset,
  duplicatePage,
  getActiveElements,
  reorderLayer,
  roundMm,
  updateActiveElements,
  type EditorMode,
} from "./visual-editor-state";
import { VisualInspector } from "./visual-inspector";
import { VisualLeftSidebar } from "./visual-left-sidebar";
import { VisualPageStrip } from "./visual-page-strip";
import { VisualPreviewModal } from "./visual-preview-modal";
import type { VisualRenderContext } from "@/lib/proposals/visual-renderer";

const MAX_HISTORY = 50;

type VisualProposalEditorProps = {
  value: VisualDesign;
  editable: boolean;
  onChange: (next: VisualDesign) => void;
  previewContext?: VisualRenderContext | null;
  previewLabel?: string;
};

export function VisualProposalEditor({
  value,
  editable: editableProp,
  onChange,
  previewContext = null,
  previewLabel,
}: VisualProposalEditorProps) {
  const { can } = usePermissions();
  const editable =
    editableProp &&
    ["own", "team", "workspace"].some(
      (s) =>
        can(`techsales.proposal_templates.create.${s}`) ||
        can(`techsales.proposal_templates.update.${s}`) ||
        can(`techsales.proposals.create.${s}`) ||
        can(`techsales.proposals.update.${s}`),
    );
  const [pageIndex, setPageIndex] = useState(0);
  const [mode, setMode] = useState<EditorMode>("page");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [zoom, setZoom] = useState(0.65);
  const [showRuler, setShowRuler] = useState(true);
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [uploadedPaths, setUploadedPaths] = useState<string[]>([]);

  const historyRef = useRef<{ past: VisualDesign[]; future: VisualDesign[] }>({
    past: [],
    future: [],
  });
  const clipboardRef = useRef<VisualElement[]>([]);
  const [, setHistoryTick] = useState(0);

  const createUploadFn = useServerFn(createProposalAssetUpload);
  const signUrlsFn = useServerFn(signProposalAssetUrls);
  const brandCtxFn = useServerFn(listBrandKitContext);

  const brandQ = useQuery({
    queryKey: ["proposal-visual-brand-kit"],
    queryFn: () => brandCtxFn(),
    staleTime: 60_000,
  });

  const safePageIndex = Math.min(pageIndex, Math.max(0, value.pages.length - 1));
  const dims = pageSizeMm(value.orientation);

  const allStoragePaths = useMemo(
    () => [...new Set([...collectVisualStoragePaths(value), ...uploadedPaths])],
    [uploadedPaths, value],
  );

  const missingPaths = useMemo(
    () => allStoragePaths.filter((p) => !signedUrls[p]),
    [allStoragePaths, signedUrls],
  );

  useEffect(() => {
    if (!missingPaths.length) return;
    let active = true;
    void signUrlsFn({ data: { paths: missingPaths } })
      .then((res) => {
        if (active && res) setSignedUrls((prev) => ({ ...prev, ...res }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [missingPaths, signUrlsFn]);

  const commitDesign = useCallback(
    (next: VisualDesign) => {
      historyRef.current.past = [...historyRef.current.past.slice(-(MAX_HISTORY - 1)), value];
      historyRef.current.future = [];
      setHistoryTick((n) => n + 1);
      onChange(next);
    },
    [onChange, value],
  );

  const undo = useCallback(() => {
    const prev = historyRef.current.past.pop();
    if (!prev) return;
    historyRef.current.future.push(value);
    setHistoryTick((n) => n + 1);
    onChange(prev);
  }, [onChange, value]);

  const redo = useCallback(() => {
    const next = historyRef.current.future.pop();
    if (!next) return;
    historyRef.current.past.push(value);
    setHistoryTick((n) => n + 1);
    onChange(next);
  }, [onChange, value]);

  const handleLiveElementsChange = useCallback(
    (elements: VisualElement[]) => {
      onChange(updateActiveElements(value, safePageIndex, mode, () => elements));
    },
    [mode, onChange, safePageIndex, value],
  );

  const handleCommitElementsChange = useCallback(
    (elements: VisualElement[]) => {
      commitDesign(updateActiveElements(value, safePageIndex, mode, () => elements));
    },
    [commitDesign, mode, safePageIndex, value],
  );

  const handleAddElement = useCallback(
    (el: VisualElement) => {
      if (!editable) return;
      const cur = getActiveElements(value, safePageIndex, mode);
      const maxZ = cur.reduce((m, e) => Math.max(m, e.z), 0);
      const placed: VisualElement = { ...el, z: maxZ + 1 };
      commitDesign(updateActiveElements(value, safePageIndex, mode, (list) => [...list, placed]));
      setSelectedIds([placed.id]);
    },
    [commitDesign, editable, mode, safePageIndex, value],
  );

  const handleInsertVariable = useCallback(
    (token: string, label: string) => {
      if (!editable) return;
      const cur = getActiveElements(value, safePageIndex, mode);
      const target =
        selectedIds.length === 1
          ? cur.find(
              (e) =>
                e.id === selectedIds[0] && !e.locked && (e.type === "heading" || e.type === "text"),
            )
          : null;
      if (target) {
        commitDesign(
          updateActiveElements(value, safePageIndex, mode, (list) =>
            list.map((e) =>
              e.id === target.id && (e.type === "heading" || e.type === "text")
                ? { ...e, props: { ...e.props, text: `${e.props.text} ${token}`.trim() } }
                : e,
            ),
          ),
        );
        return;
      }
      if (token === "{{company.logo}}" || token === "{{provider.logo}}") {
        const imgBase = createDefaultElement("image", dims.width, dims.height, 1, value.brandKit);
        if (imgBase.type === "image") {
          const isClient = token === "{{company.logo}}";
          handleAddElement({
            ...imgBase,
            name: label,
            w: 44,
            h: 14,
            props: {
              ...imgBase.props,
              alt: label,
              fit: "contain",
              bindLogo: isClient ? "client" : "contracting",
            },
          });
        }
        return;
      }
      const base = createDefaultElement("text", dims.width, dims.height, 1, value.brandKit);
      if (base.type === "text") {
        handleAddElement({
          ...base,
          name: label,
          w: 90,
          h: 10,
          props: { text: token },
        });
      }
    },
    [
      commitDesign,
      dims.height,
      dims.width,
      editable,
      handleAddElement,
      mode,
      safePageIndex,
      selectedIds,
      value,
    ],
  );

  const handleDuplicateSelected = useCallback(() => {
    if (!editable || !selectedIds.length) return;
    const cur = getActiveElements(value, safePageIndex, mode);
    const picked = cur.filter((e) => selectedIds.includes(e.id));
    if (!picked.length) return;
    const maxZ = cur.reduce((m, e) => Math.max(m, e.z), 0);
    const clones = cloneElementsWithOffset(picked, 6, maxZ + 1);
    commitDesign(updateActiveElements(value, safePageIndex, mode, (list) => [...list, ...clones]));
    setSelectedIds(clones.map((c) => c.id));
  }, [commitDesign, editable, mode, safePageIndex, selectedIds, value]);

  const handleDeleteSelected = useCallback(() => {
    if (!editable || !selectedIds.length) return;
    const set = new Set(selectedIds);
    commitDesign(
      updateActiveElements(value, safePageIndex, mode, (list) =>
        list.filter((e) => !set.has(e.id) || e.locked),
      ),
    );
    setSelectedIds([]);
  }, [commitDesign, editable, mode, safePageIndex, selectedIds, value]);

  const handleToggleGroup = useCallback(() => {
    if (!editable || selectedIds.length < 2) return;
    const cur = getActiveElements(value, safePageIndex, mode);
    const picked = cur.filter((e) => selectedIds.includes(e.id));
    const allGrouped = picked.every((e) => e.groupId && e.groupId === picked[0]?.groupId);
    const nextGroupId = allGrouped ? null : uid("grp");
    const set = new Set(selectedIds);
    commitDesign(
      updateActiveElements(value, safePageIndex, mode, (list) =>
        list.map((e) => (set.has(e.id) ? { ...e, groupId: nextGroupId } : e)),
      ),
    );
  }, [commitDesign, editable, mode, safePageIndex, selectedIds, value]);

  const handleUploadImage = useCallback(
    async (file: File): Promise<string | null> => {
      if (!editable) return null;
      const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];
      if (!allowed.includes(file.type)) {
        toast.error("Formato não suportado. Use PNG, JPG, WebP, GIF ou SVG.");
        return null;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Imagem acima do limite de 5 MB.");
        return null;
      }
      setUploading(true);
      try {
        const prep = await createUploadFn({
          data: {
            filename: file.name,
            mime: file.type as
              | "image/png"
              | "image/jpeg"
              | "image/webp"
              | "image/gif"
              | "image/svg+xml",
            size_bytes: file.size,
          },
        });
        const { error: upErr } = await supabase.storage
          .from(prep.bucket)
          .uploadToSignedUrl(prep.path, prep.token, file, { contentType: file.type });
        if (upErr) throw new Error(upErr.message);
        const signed = await signUrlsFn({ data: { paths: [prep.path] } });
        if (signed) setSignedUrls((prev) => ({ ...prev, ...signed }));
        setUploadedPaths((prev) => [...new Set([prep.path, ...prev])]);
        toast.success("Imagem enviada.");
        return prep.path;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao enviar imagem.");
        return null;
      } finally {
        setUploading(false);
      }
    },
    [createUploadFn, editable, signUrlsFn],
  );

  useEffect(() => {
    if (!editable) return;
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }
      if (mod && e.key.toLowerCase() === "c" && selectedIds.length) {
        const cur = getActiveElements(value, safePageIndex, mode);
        clipboardRef.current = cur.filter((el) => selectedIds.includes(el.id));
        return;
      }
      if (mod && e.key.toLowerCase() === "v" && clipboardRef.current.length) {
        e.preventDefault();
        const cur = getActiveElements(value, safePageIndex, mode);
        const maxZ = cur.reduce((m, el) => Math.max(m, el.z), 0);
        const clones = cloneElementsWithOffset(clipboardRef.current, 6, maxZ + 1);
        commitDesign(
          updateActiveElements(value, safePageIndex, mode, (list) => [...list, ...clones]),
        );
        setSelectedIds(clones.map((c) => c.id));
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length) {
        e.preventDefault();
        handleDeleteSelected();
        return;
      }
      if (
        selectedIds.length &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        const set = new Set(selectedIds);
        commitDesign(
          updateActiveElements(value, safePageIndex, mode, (list) =>
            list.map((el) =>
              set.has(el.id) && !el.locked
                ? { ...el, x: roundMm(el.x + dx), y: roundMm(el.y + dy) }
                : el,
            ),
          ),
        );
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    commitDesign,
    editable,
    handleDeleteSelected,
    handleDuplicateSelected,
    mode,
    redo,
    safePageIndex,
    selectedIds,
    undo,
    value,
  ]);

  return (
    <div
      data-testid="visual-proposal-editor"
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-background"
          : "flex h-[760px] flex-col overflow-hidden rounded-lg border border-border bg-background"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="icon"
            variant={showLeft ? "secondary" : "outline"}
            className="h-8 w-8"
            onClick={() => setShowLeft((v) => !v)}
            title={showLeft ? "Ocultar ferramentas" : "Mostrar ferramentas"}
            aria-label={showLeft ? "Ocultar ferramentas" : "Mostrar ferramentas"}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            disabled={!editable || historyRef.current.past.length === 0}
            onClick={undo}
            title="Desfazer (Ctrl+Z)"
            aria-label="Desfazer"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            disabled={!editable || historyRef.current.future.length === 0}
            onClick={redo}
            title="Refazer (Ctrl+Shift+Z)"
            aria-label="Refazer"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <div className="mx-1 h-5 w-px bg-border" />
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => setZoom((z) => Math.max(0.35, Math.round((z - 0.1) * 100) / 100))}
            title="Diminuir zoom"
            aria-label="Diminuir zoom"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-xs font-medium tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => setZoom((z) => Math.min(1.8, Math.round((z + 0.1) * 100) / 100))}
            title="Aumentar zoom"
            aria-label="Aumentar zoom"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={showRuler ? "secondary" : "outline"}
            className="h-8 gap-1 text-xs"
            onClick={() => setShowRuler((r) => !r)}
          >
            <Ruler className="h-3.5 w-3.5" />
            Régua
          </Button>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {mode === "master"
              ? "Editando Página Mestre (cabeçalho e rodapé)"
              : `Página ${safePageIndex + 1} de ${value.pages.length} · A4 ${value.orientation === "landscape" ? "Paisagem" : "Retrato"}`}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="h-3.5 w-3.5" />
            Pré-visualizar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setFullscreen((f) => !f)}
          >
            {fullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                Sair da tela cheia
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" />
                Tela cheia
              </>
            )}
          </Button>
          <Button
            type="button"
            size="icon"
            variant={showRight ? "secondary" : "outline"}
            className="h-8 w-8"
            onClick={() => setShowRight((v) => !v)}
            title={showRight ? "Ocultar inspetor" : "Mostrar inspetor"}
            aria-label={showRight ? "Ocultar inspetor" : "Mostrar inspetor"}
          >
            <PanelRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {showLeft && (
          <VisualLeftSidebar
            design={value}
            editable={editable}
            uploading={uploading}
            brandEntities={brandQ.data?.legalEntities ?? []}
            workspacePrimaryColor={brandQ.data?.workspacePrimaryColor ?? null}
            signedUrls={signedUrls}
            uploadedPaths={allStoragePaths}
            onAddElement={handleAddElement}
            onInsertVariable={handleInsertVariable}
            onUpdateBrandKit={(patch: Partial<VisualBrandKit>) =>
              commitDesign({ ...value, brandKit: { ...value.brandKit, ...patch } })
            }
            onApplyStarter={(starter) => {
              commitDesign(starter);
              setPageIndex(0);
              setMode("page");
              setSelectedIds([]);
              toast.success("Modelo editorial aplicado. Personalize as páginas e salve.");
            }}
            onUploadImage={handleUploadImage}
          />
        )}

        <VisualCanvas
          design={value}
          pageIndex={safePageIndex}
          mode={mode}
          zoom={zoom}
          showRuler={showRuler}
          editable={editable}
          selectedIds={selectedIds}
          signedUrls={signedUrls}
          workspaceLogoUrl={brandQ.data?.workspaceLogoUrl ?? null}
          onSelect={setSelectedIds}
          onLiveElementsChange={handleLiveElementsChange}
          onCommitElementsChange={handleCommitElementsChange}
        />

        {showRight && (
          <VisualInspector
            design={value}
            pageIndex={safePageIndex}
            mode={mode}
            editable={editable}
            selectedIds={selectedIds}
            onSelect={setSelectedIds}
            onUpdateElement={(id, updater) =>
              commitDesign(
                updateActiveElements(value, safePageIndex, mode, (list) =>
                  list.map((e) => (e.id === id ? updater(e) : e)),
                ),
              )
            }
            onUpdatePage={(patch) =>
              commitDesign({
                ...value,
                pages: value.pages.map((p, idx) =>
                  idx === safePageIndex ? { ...p, ...patch } : p,
                ),
              })
            }
            onUpdateOrientation={(orientation) => commitDesign({ ...value, orientation })}
            onUpdateMaster={(patch) =>
              commitDesign({ ...value, master: { ...value.master, ...patch } })
            }
            onLayerAction={(action) =>
              commitDesign(
                updateActiveElements(value, safePageIndex, mode, (list) =>
                  reorderLayer(list, selectedIds, action),
                ),
              )
            }
            onAlign={(alignment) =>
              commitDesign(
                updateActiveElements(value, safePageIndex, mode, (list) =>
                  alignSelectedElements(list, selectedIds, alignment, dims.width, dims.height),
                ),
              )
            }
            onDuplicateSelected={handleDuplicateSelected}
            onDeleteSelected={handleDeleteSelected}
            onToggleGroup={handleToggleGroup}
            onUploadImage={handleUploadImage}
          />
        )}
      </div>

      <VisualPageStrip
        design={value}
        pageIndex={safePageIndex}
        mode={mode}
        editable={editable}
        onSelectPage={(idx) => {
          setMode("page");
          setPageIndex(idx);
          setSelectedIds([]);
        }}
        onToggleMaster={() => {
          setMode((m) => (m === "master" ? "page" : "master"));
          setSelectedIds([]);
        }}
        onAddPage={() => {
          if (value.pages.length >= VISUAL_MAX_PAGES) {
            toast.error(`Limite de ${VISUAL_MAX_PAGES} páginas atingido.`);
            return;
          }
          const nextPage = {
            id: uid("page"),
            name: `Página ${value.pages.length + 1}`,
            backgroundColor: "#FFFFFF",
            useMaster: true,
            elements: [],
          };
          commitDesign({ ...value, pages: [...value.pages, nextPage] });
          setMode("page");
          setPageIndex(value.pages.length);
          setSelectedIds([]);
        }}
        onDuplicatePage={(idx) => {
          const src = value.pages[idx];
          if (!src || value.pages.length >= VISUAL_MAX_PAGES) return;
          const copy = duplicatePage(src, idx + 1);
          const pages = [...value.pages];
          pages.splice(idx + 1, 0, copy);
          commitDesign({ ...value, pages });
          setMode("page");
          setPageIndex(idx + 1);
          setSelectedIds([]);
        }}
        onMovePage={(from, to) => {
          if (to < 0 || to >= value.pages.length) return;
          const pages = [...value.pages];
          const [moved] = pages.splice(from, 1);
          if (!moved) return;
          pages.splice(to, 0, moved);
          commitDesign({ ...value, pages });
          setPageIndex(to);
        }}
        onDeletePage={(idx) => {
          if (value.pages.length <= 1) return;
          const pages = value.pages.filter((_, i) => i !== idx);
          commitDesign({ ...value, pages });
          setPageIndex(Math.max(0, Math.min(idx, pages.length - 1)));
          setSelectedIds([]);
        }}
      />

      <VisualPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        design={value}
        signedUrls={signedUrls}
        workspaceLogoUrl={brandQ.data?.workspaceLogoUrl ?? null}
        draftContext={previewContext}
        {...(previewLabel ? { draftLabel: previewLabel } : {})}
      />
    </div>
  );
}
