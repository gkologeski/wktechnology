import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BLOCK_LIBRARY,
  blocksToHtml,
  createBlock,
  DEFAULT_THEME,
  defaultDocument,
  renderBlock,
  type BlockType,
  type TemplateBlock,
  type TemplateDocument,
  type TemplateTheme,
} from "@/lib/quote-template-blocks";
import { renderQuoteTemplate, sampleQuoteContext } from "@/lib/quote-template-renderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageInput } from "@/components/ui/image-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Calculator,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  FileText,
  GripVertical,
  Heading,
  Image as ImageIcon,
  Minus,
  MousePointerClick,
  MoveVertical,
  Palette,
  Plus,
  StickyNote,
  Table as TableIcon,
  Trash2,
  Type,
  UserCheck,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Heading,
  Image: ImageIcon,
  Users,
  UserCheck,
  Table: TableIcon,
  Calculator,
  StickyNote,
  FileText,
  Type,
  MousePointerClick,
  Minus,
  MoveVertical,
};

const ACTIONS_PLACEHOLDER = `<div style="display:inline-flex;gap:10px;flex-wrap:wrap;justify-content:center;"><span style="background:#10b981;color:#fff;padding:10px 18px;border-radius:8px;font-weight:600;">Aceitar</span><span style="background:#ef4444;color:#fff;padding:10px 18px;border-radius:8px;font-weight:600;">Recusar</span><span style="background:#3b82f6;color:#fff;padding:10px 18px;border-radius:8px;font-weight:600;">Pagar</span></div>`;

type Props = {
  doc: TemplateDocument;
  onChange: (doc: TemplateDocument) => void;
};

export function QuoteVisualEditor({ doc, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ kind: "palette" | "block"; payload: string } | null>(
    null,
  );
  const [zoom, setZoom] = useState(0.85);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const selectedBlock = doc.blocks.find((b) => b.id === selectedId) ?? null;

  // Auto-open inspector when something is selected
  useEffect(() => {
    if (selectedId) setInspectorOpen(true);
  }, [selectedId]);

  const updateBlocks = (blocks: TemplateBlock[]) => onChange({ ...doc, blocks });
  const updateBlock = (id: string, patch: Partial<TemplateBlock>) => {
    updateBlocks(
      doc.blocks.map((b) =>
        b.id === id ? { ...b, ...patch, props: { ...b.props, ...(patch.props ?? {}) } } : b,
      ),
    );
  };
  const removeBlock = (id: string) => {
    updateBlocks(doc.blocks.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };
  const duplicateBlock = (id: string) => {
    const idx = doc.blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const copy = {
      ...doc.blocks[idx],
      id: `b_${Math.random().toString(36).slice(2, 10)}`,
      props: { ...doc.blocks[idx].props },
    };
    const next = [...doc.blocks];
    next.splice(idx + 1, 0, copy);
    updateBlocks(next);
    setSelectedId(copy.id);
  };
  const addBlock = (type: BlockType, index?: number) => {
    const block = createBlock(type);
    const next = [...doc.blocks];
    if (index === undefined) next.push(block);
    else next.splice(index, 0, block);
    updateBlocks(next);
    setSelectedId(block.id);
  };

  const handleDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    if (id.startsWith("palette:")) setDragging({ kind: "palette", payload: id.slice(8) });
    else setDragging({ kind: "block", payload: id });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith("palette:")) {
      const type = activeId.slice(8) as BlockType;
      let insertIndex = doc.blocks.length;
      if (overId !== "canvas-drop") {
        const idx = doc.blocks.findIndex((b) => b.id === overId);
        if (idx >= 0) insertIndex = idx + 1;
      }
      addBlock(type, insertIndex);
      return;
    }

    if (activeId !== overId) {
      const from = doc.blocks.findIndex((b) => b.id === activeId);
      const to = doc.blocks.findIndex((b) => b.id === overId);
      if (from >= 0 && to >= 0) updateBlocks(arrayMove(doc.blocks, from, to));
    }
  };

  return (
    <TooltipProvider delayDuration={250}>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="quote-editor relative flex h-[calc(100vh-220px)] min-h-[720px] overflow-hidden rounded-2xl border border-border bg-slate-950/95 shadow-xl">
          {/* LEFT RAIL — icon-only palette, Canva style */}
          <LeftRail onAdd={addBlock} />

          {/* CENTER — workspace with floating page */}
          <div className="relative flex-1 overflow-hidden">
            <WorkspaceToolbar
              zoom={zoom}
              setZoom={setZoom}
              previewOpen={previewOpen}
              setPreviewOpen={setPreviewOpen}
              onOpenTheme={() => {
                setSelectedId(null);
                setInspectorOpen(true);
              }}
              blockCount={doc.blocks.length}
            />
            <div
              className="absolute inset-0 top-[52px] overflow-auto bg-[radial-gradient(circle_at_25%_-10%,rgba(99,102,241,0.18),transparent_55%),radial-gradient(circle_at_85%_110%,rgba(14,165,233,0.14),transparent_50%)] bg-slate-900"
              onClick={() => setSelectedId(null)}
            >
              <div className="flex min-h-full items-start justify-center p-8">
                <div
                  style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
                  className="transition-transform duration-150"
                >
                  <PageCanvas
                    doc={doc}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onRemove={removeBlock}
                    onDuplicate={duplicateBlock}
                  />
                </div>
              </div>
            </div>

            {previewOpen && <PreviewOverlay doc={doc} onClose={() => setPreviewOpen(false)} />}
          </div>

          {/* RIGHT — floating inspector */}
          <InspectorPanel
            open={inspectorOpen}
            onToggle={() => setInspectorOpen((v) => !v)}
            selectedBlock={selectedBlock}
            theme={doc.theme}
            onBlockChange={(patch) => selectedBlock && updateBlock(selectedBlock.id, patch)}
            onThemeChange={(theme) => onChange({ ...doc, theme })}
            onRemoveBlock={() => selectedBlock && removeBlock(selectedBlock.id)}
            onClearSelection={() => setSelectedId(null)}
          />
        </div>

        <DragOverlay>
          {dragging?.kind === "palette" ? (
            <div className="rounded-lg border border-primary/40 bg-card/95 px-3 py-2 text-sm shadow-2xl backdrop-blur">
              {BLOCK_LIBRARY.find((b) => b.type === dragging.payload)?.label ?? dragging.payload}
            </div>
          ) : dragging?.kind === "block" ? (
            <div className="rounded-lg border border-primary bg-primary/10 px-3 py-2 text-sm text-primary shadow-xl">
              Movendo bloco…
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </TooltipProvider>
  );
}

/* ---------------- Left rail ---------------- */

function LeftRail({ onAdd }: { onAdd: (type: BlockType) => void }) {
  return (
    <div className="flex w-[72px] shrink-0 flex-col items-center gap-1 border-r border-white/10 bg-slate-950/60 py-3">
      <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-500">
        Blocos
      </div>
      <div className="flex flex-col gap-1.5">
        {BLOCK_LIBRARY.map((b) => (
          <RailItem
            key={b.type}
            type={b.type}
            label={b.label}
            description={b.description}
            icon={b.icon}
            onAdd={() => onAdd(b.type)}
          />
        ))}
      </div>
    </div>
  );
}

function RailItem({
  type,
  label,
  description,
  icon,
  onAdd,
}: {
  type: BlockType;
  label: string;
  description: string;
  icon: string;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${type}` });
  const Icon = ICONS[icon] ?? Type;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          onClick={onAdd}
          className={`group relative flex h-14 w-14 cursor-grab flex-col items-center justify-center gap-0.5 rounded-xl border border-transparent text-slate-300 transition-all hover:border-primary/50 hover:bg-white/5 hover:text-white active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
        >
          <Icon className="h-[18px] w-[18px]" />
          <span className="line-clamp-1 text-[9px] leading-tight">{label.split(" ")[0]}</span>
          <span className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground group-hover:flex">
            <Plus className="h-2.5 w-2.5" />
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[200px]">
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
        <div className="mt-1 text-[10px] text-muted-foreground">
          Clique para adicionar · arraste para posicionar
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/* ---------------- Workspace toolbar ---------------- */

function WorkspaceToolbar({
  zoom,
  setZoom,
  previewOpen,
  setPreviewOpen,
  onOpenTheme,
  blockCount,
}: {
  zoom: number;
  setZoom: (n: number) => void;
  previewOpen: boolean;
  setPreviewOpen: (b: boolean) => void;
  onOpenTheme: () => void;
  blockCount: number;
}) {
  return (
    <div className="absolute inset-x-0 top-0 z-20 flex h-[52px] items-center justify-between border-b border-white/10 bg-slate-950/85 px-4 backdrop-blur">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="rounded-full bg-white/5 px-2 py-0.5 font-medium text-slate-200">
          {blockCount} {blockCount === 1 ? "bloco" : "blocos"}
        </span>
        <span className="hidden sm:inline">Arraste blocos da lateral · clique para editar</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 gap-1 text-slate-200 hover:bg-white/10 hover:text-white"
          onClick={onOpenTheme}
        >
          <Palette className="h-3.5 w-3.5" /> Tema
        </Button>
        <div className="mx-1 flex items-center gap-0.5 rounded-md bg-white/5 p-0.5">
          <button
            type="button"
            onClick={() => setZoom(Math.max(0.4, Number((zoom - 0.1).toFixed(2))))}
            className="rounded p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label="Diminuir zoom"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="w-10 text-center text-[11px] tabular-nums text-slate-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom(Math.min(1.5, Number((zoom + 0.1).toFixed(2))))}
            className="rounded p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label="Aumentar zoom"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
        <Button
          type="button"
          size="sm"
          variant={previewOpen ? "default" : "ghost"}
          className={`h-8 gap-1 ${previewOpen ? "" : "text-slate-200 hover:bg-white/10 hover:text-white"}`}
          onClick={() => setPreviewOpen(!previewOpen)}
        >
          <Eye className="h-3.5 w-3.5" /> Preview
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Page canvas (live rendered) ---------------- */

function PageCanvas({
  doc,
  selectedId,
  onSelect,
  onRemove,
  onDuplicate,
}: {
  doc: TemplateDocument;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-drop" });
  const theme = doc.theme;
  const ctx = useMemo(() => sampleQuoteContext(), []);

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => e.stopPropagation()}
      className={`relative w-[820px] rounded-md shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6),0_18px_36px_-18px_rgba(0,0,0,0.45)] transition-shadow ${isOver ? "ring-2 ring-primary ring-offset-4 ring-offset-slate-900" : ""}`}
      style={{
        background: theme.bgColor,
        color: theme.textColor,
        fontFamily: theme.fontFamily,
        padding: theme.pagePadding,
      }}
    >
      {doc.blocks.length === 0 ? (
        <div className="flex h-[600px] flex-col items-center justify-center gap-3 text-center text-slate-400">
          <div className="rounded-full border-2 border-dashed border-slate-300 p-6">
            <Plus className="h-8 w-8 text-slate-400" />
          </div>
          <div className="text-sm font-medium text-slate-500">Página em branco</div>
          <div className="max-w-[280px] text-xs text-slate-400">
            Clique em um bloco na lateral esquerda para adicionar, ou arraste-o para esta área.
          </div>
        </div>
      ) : (
        <SortableContext items={doc.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {doc.blocks.map((b) => (
              <CanvasBlock
                key={b.id}
                block={b}
                theme={theme}
                ctx={ctx}
                selected={b.id === selectedId}
                onSelect={() => onSelect(b.id)}
                onRemove={() => onRemove(b.id)}
                onDuplicate={() => onDuplicate(b.id)}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}

function CanvasBlock({
  block,
  theme,
  ctx,
  selected,
  onSelect,
  onRemove,
  onDuplicate,
}: {
  block: TemplateBlock;
  theme: TemplateTheme;
  ctx: ReturnType<typeof sampleQuoteContext>;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  const def = BLOCK_LIBRARY.find((b) => b.type === block.type);
  const Icon = ICONS[def?.icon ?? "Type"] ?? Type;

  const html = useMemo(() => {
    try {
      const raw = renderBlock(block, theme);
      const rendered = renderQuoteTemplate(raw, ctx);
      const withActions = rendered.replace(/\{\{#actions\/\}\}/g, ACTIONS_PLACEHOLDER);
      return DOMPurify.sanitize(withActions, { ADD_TAGS: ["style"] });
    } catch {
      return `<div style="color:#b91c1c;font-size:12px;">Erro ao renderizar bloco.</div>`;
    }
  }, [block, theme, ctx]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={`group relative cursor-pointer rounded-md transition-all ${
        selected
          ? "outline outline-2 outline-primary outline-offset-2"
          : "hover:outline hover:outline-2 hover:outline-primary/40 hover:outline-offset-2"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      {/* Floating label/toolbar when selected or hovered */}
      <div
        className={`absolute -top-7 left-0 z-10 flex items-center gap-1 transition-opacity ${
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <span className="flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground shadow-md">
          <Icon className="h-3 w-3" />
          {def?.label ?? block.type}
        </span>
      </div>
      <div
        className={`absolute -top-7 right-0 z-10 flex items-center gap-0.5 rounded-md bg-slate-900/95 px-1 py-0.5 shadow-md transition-opacity ${
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <button
          type="button"
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white active:cursor-grabbing"
          title="Arrastar para reordenar"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white"
          title="Duplicar"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="rounded p-1 text-red-300 hover:bg-red-500/20 hover:text-red-200"
          title="Remover"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        className="pointer-events-none select-none"
        dangerouslySetInnerHTML={{ __html: html || `<div style="height:24px"></div>` }}
      />
    </div>
  );
}

/* ---------------- Right inspector ---------------- */

function InspectorPanel({
  open,
  onToggle,
  selectedBlock,
  theme,
  onBlockChange,
  onThemeChange,
  onRemoveBlock,
  onClearSelection,
}: {
  open: boolean;
  onToggle: () => void;
  selectedBlock: TemplateBlock | null;
  theme: TemplateTheme;
  onBlockChange: (patch: Partial<TemplateBlock>) => void;
  onThemeChange: (theme: TemplateTheme) => void;
  onRemoveBlock: () => void;
  onClearSelection: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-0 top-1/2 z-30 -translate-y-1/2 rounded-l-md border border-r-0 border-white/10 bg-slate-900 px-1 py-3 text-slate-300 hover:bg-slate-800 hover:text-white"
        aria-label={open ? "Esconder painel" : "Mostrar painel"}
        style={{ transform: open ? "translate(0,-50%)" : "translate(0,-50%)" }}
      >
        {open ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
      <div
        className={`relative flex shrink-0 flex-col border-l border-white/10 bg-card text-card-foreground transition-all duration-200 ${
          open ? "w-[320px]" : "w-0 overflow-hidden"
        }`}
      >
        {open && (
          <>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {selectedBlock ? "Propriedades" : "Tema do modelo"}
                </div>
                {selectedBlock && (
                  <div className="text-sm font-medium">
                    {BLOCK_LIBRARY.find((b) => b.type === selectedBlock.type)?.label ??
                      selectedBlock.type}
                  </div>
                )}
              </div>
              {selectedBlock && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={onClearSelection}
                  title="Voltar ao tema"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {selectedBlock ? (
                <BlockInspector
                  block={selectedBlock}
                  onChange={onBlockChange}
                  onRemove={onRemoveBlock}
                />
              ) : (
                <ThemeInspector theme={theme} onChange={onThemeChange} />
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function BlockInspector({
  block,
  onChange,
  onRemove,
}: {
  block: TemplateBlock;
  onChange: (patch: Partial<TemplateBlock>) => void;
  onRemove: () => void;
}) {
  const setProp = (k: string, v: unknown) => onChange({ props: { [k]: v } });
  const p = block.props;

  return (
    <div className="space-y-4 text-sm">
      {block.type === "header" && (
        <>
          <Field label="Título">
            <Input
              value={String(p.title ?? "")}
              onChange={(e) => setProp("title", e.target.value)}
            />
          </Field>
          <Field label="Subtítulo">
            <Input
              value={String(p.subtitle ?? "")}
              onChange={(e) => setProp("subtitle", e.target.value)}
            />
          </Field>
          <Field label="Alinhamento">
            <SelectGroup
              value={String(p.align ?? "left")}
              options={[
                ["left", "Esquerda"],
                ["center", "Centro"],
                ["right", "Direita"],
              ]}
              onChange={(v) => setProp("align", v)}
            />
          </Field>
          <Field label="Cor de fundo (opcional)">
            <div className="flex items-center gap-2">
              <Input
                type="color"
                className="h-9 w-14 p-1"
                value={String(p.bg || "#ffffff")}
                onChange={(e) => setProp("bg", e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => setProp("bg", "")}
              >
                Sem fundo
              </Button>
            </div>
          </Field>
        </>
      )}

      {block.type === "logo" && (
        <>
          <Field label="Imagem">
            <ImageInput value={String(p.url ?? "")} onChange={(v) => setProp("url", v ?? "")} />
          </Field>
          <Field label="Largura (px)">
            <Input
              type="number"
              value={Number(p.width ?? 140)}
              onChange={(e) => setProp("width", Number(e.target.value))}
            />
          </Field>
          <Field label="Alinhamento">
            <SelectGroup
              value={String(p.align ?? "left")}
              options={[
                ["left", "Esquerda"],
                ["center", "Centro"],
                ["right", "Direita"],
              ]}
              onChange={(v) => setProp("align", v)}
            />
          </Field>
        </>
      )}

      {block.type === "customer" && (
        <>
          <Field label="Título">
            <Input
              value={String(p.title ?? "Para")}
              onChange={(e) => setProp("title", e.target.value)}
            />
          </Field>
          <ToggleField
            label="Mostrar nome da empresa"
            checked={Boolean(p.showCompany)}
            onChange={(v) => setProp("showCompany", v)}
          />
          <ToggleField
            label="Mostrar contato"
            checked={Boolean(p.showContact)}
            onChange={(v) => setProp("showContact", v)}
          />
          <ToggleField
            label="Mostrar e-mail"
            checked={Boolean(p.showEmail)}
            onChange={(v) => setProp("showEmail", v)}
          />
        </>
      )}

      {block.type === "agent" && (
        <>
          <Field label="Título">
            <Input
              value={String(p.title ?? "Emissor")}
              onChange={(e) => setProp("title", e.target.value)}
            />
          </Field>
          <ToggleField
            label="Mostrar vendedor"
            checked={Boolean(p.showAgent)}
            onChange={(v) => setProp("showAgent", v)}
          />
          <ToggleField
            label="Data de emissão"
            checked={Boolean(p.showCreated)}
            onChange={(v) => setProp("showCreated", v)}
          />
          <ToggleField
            label="Validade"
            checked={Boolean(p.showValidity)}
            onChange={(v) => setProp("showValidity", v)}
          />
        </>
      )}

      {block.type === "items_table" && (
        <>
          <ToggleField
            label="Coluna descrição"
            checked={Boolean(p.showDescription)}
            onChange={(v) => setProp("showDescription", v)}
          />
          <ToggleField
            label="Coluna desconto"
            checked={Boolean(p.showDiscount)}
            onChange={(v) => setProp("showDiscount", v)}
          />
          <ToggleField
            label="Coluna imposto"
            checked={Boolean(p.showTax)}
            onChange={(v) => setProp("showTax", v)}
          />
          <Field label="Cor do cabeçalho">
            <div className="flex items-center gap-2">
              <Input
                type="color"
                className="h-9 w-14 p-1"
                value={String(p.headerBg === "auto" || !p.headerBg ? "#4f46e5" : p.headerBg)}
                onChange={(e) => setProp("headerBg", e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => setProp("headerBg", "auto")}
              >
                Cor do tema
              </Button>
            </div>
          </Field>
        </>
      )}

      {block.type === "totals" && (
        <>
          <ToggleField
            label="Subtotal"
            checked={Boolean(p.showSubtotal)}
            onChange={(v) => setProp("showSubtotal", v)}
          />
          <ToggleField
            label="Descontos"
            checked={Boolean(p.showDiscount)}
            onChange={(v) => setProp("showDiscount", v)}
          />
          <ToggleField
            label="Impostos"
            checked={Boolean(p.showTax)}
            onChange={(v) => setProp("showTax", v)}
          />
          <Field label="Alinhamento">
            <SelectGroup
              value={String(p.align ?? "right")}
              options={[
                ["left", "Esquerda"],
                ["center", "Centro"],
                ["right", "Direita"],
              ]}
              onChange={(v) => setProp("align", v)}
            />
          </Field>
        </>
      )}

      {(block.type === "notes" || block.type === "terms") && (
        <Field label="Título">
          <Input value={String(p.title ?? "")} onChange={(e) => setProp("title", e.target.value)} />
        </Field>
      )}

      {block.type === "text" && (
        <>
          <Field label="Conteúdo">
            <Textarea
              rows={6}
              value={String(p.content ?? "")}
              onChange={(e) => setProp("content", e.target.value)}
              placeholder="Pode usar {{quote.total}}, {{contact.name}}…"
            />
          </Field>
          <Field label="Alinhamento">
            <SelectGroup
              value={String(p.align ?? "left")}
              options={[
                ["left", "Esquerda"],
                ["center", "Centro"],
                ["right", "Direita"],
              ]}
              onChange={(v) => setProp("align", v)}
            />
          </Field>
        </>
      )}

      {block.type === "spacer" && (
        <Field label="Altura (px)">
          <Input
            type="number"
            value={Number(p.height ?? 24)}
            onChange={(e) => setProp("height", Number(e.target.value))}
          />
        </Field>
      )}

      {block.type === "image" && (
        <>
          <Field label="URL">
            <Input
              value={String(p.url ?? "")}
              onChange={(e) => setProp("url", e.target.value)}
              placeholder="https://..."
            />
          </Field>
          <Field label="Largura (px)">
            <Input
              type="number"
              value={Number(p.width ?? 480)}
              onChange={(e) => setProp("width", Number(e.target.value))}
            />
          </Field>
          <Field label="Alinhamento">
            <SelectGroup
              value={String(p.align ?? "center")}
              options={[
                ["left", "Esquerda"],
                ["center", "Centro"],
                ["right", "Direita"],
              ]}
              onChange={(v) => setProp("align", v)}
            />
          </Field>
        </>
      )}

      {(block.type === "actions" || block.type === "divider") && (
        <p className="text-xs text-muted-foreground">Este bloco não possui configurações.</p>
      )}

      <Separator />
      <Button
        variant="outline"
        className="w-full text-destructive hover:text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="mr-2 h-3.5 w-3.5" /> Remover bloco
      </Button>
    </div>
  );
}

function ThemeInspector({
  theme,
  onChange,
}: {
  theme: TemplateTheme;
  onChange: (t: TemplateTheme) => void;
}) {
  const set = (patch: Partial<TemplateTheme>) => onChange({ ...theme, ...patch });
  const palettes: Array<[string, string]> = [
    ["#4f46e5", "Índigo"],
    ["#0ea5e9", "Sky"],
    ["#10b981", "Esmeralda"],
    ["#f59e0b", "Âmbar"],
    ["#ef4444", "Rubi"],
    ["#0f172a", "Grafite"],
  ];
  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs text-muted-foreground">
        Sem bloco selecionado. Ajuste o tema global do modelo aqui — ou clique em um bloco na página
        para editar.
      </p>
      <Separator />

      <Field label="Cor primária">
        <div className="flex flex-wrap gap-1.5">
          {palettes.map(([color, name]) => (
            <button
              key={color}
              type="button"
              onClick={() => set({ primaryColor: color })}
              className={`h-7 w-7 rounded-full ring-offset-2 transition-all hover:scale-110 ${theme.primaryColor === color ? "ring-2 ring-foreground" : ""}`}
              style={{ background: color }}
              title={name}
              aria-label={name}
            />
          ))}
          <Input
            type="color"
            className="h-7 w-10 p-0.5"
            value={theme.primaryColor}
            onChange={(e) => set({ primaryColor: e.target.value })}
          />
        </div>
      </Field>

      <Field label="Cor de fundo">
        <Input
          type="color"
          className="h-9 w-full"
          value={theme.bgColor}
          onChange={(e) => set({ bgColor: e.target.value })}
        />
      </Field>
      <Field label="Cor do texto">
        <Input
          type="color"
          className="h-9 w-full"
          value={theme.textColor}
          onChange={(e) => set({ textColor: e.target.value })}
        />
      </Field>
      <Field label="Fonte">
        <SelectGroup
          value={theme.fontFamily}
          options={[
            ["'Inter', system-ui, sans-serif", "Inter"],
            ["Georgia, 'Times New Roman', serif", "Georgia"],
            ["'Helvetica Neue', Arial, sans-serif", "Helvetica"],
            ["'Courier New', monospace", "Courier"],
          ]}
          onChange={(v) => set({ fontFamily: v })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Espaçamento (px)">
          <Input
            type="number"
            value={theme.pagePadding}
            onChange={(e) => set({ pagePadding: Number(e.target.value) })}
          />
        </Field>
        <Field label="Raio (px)">
          <Input
            type="number"
            value={theme.radius}
            onChange={(e) => set({ radius: Number(e.target.value) })}
          />
        </Field>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={() => onChange({ ...DEFAULT_THEME })}
      >
        Restaurar tema padrão
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2">
      <Label className="text-xs">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SelectGroup({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<[string, string]>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([val, label]) => (
        <button
          key={val}
          type="button"
          onClick={() => onChange(val)}
          className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${value === val ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Preview overlay ---------------- */

function PreviewOverlay({ doc, onClose }: { doc: TemplateDocument; onClose: () => void }) {
  const html = useMemo(() => blocksToHtml(doc), [doc]);
  const [safe, setSafe] = useState("");
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    try {
      const rendered = renderQuoteTemplate(html, sampleQuoteContext());
      const withActions = rendered.replace(/\{\{#actions\/\}\}/g, ACTIONS_PLACEHOLDER);
      setSafe(DOMPurify.sanitize(withActions, { WHOLE_DOCUMENT: true, ADD_TAGS: ["style"] }));
    } catch (e) {
      setSafe(`<pre style="color:#b91c1c">${String(e)}</pre>`);
    }
  }, [html]);
  return (
    <div className="absolute inset-0 top-[52px] z-30 flex flex-col bg-slate-900/95 backdrop-blur">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="text-sm font-medium text-white">Pré-visualização com dados de exemplo</div>
        <Button
          size="sm"
          variant="ghost"
          className="text-white hover:bg-white/10"
          onClick={onClose}
        >
          <X className="mr-1 h-3.5 w-3.5" /> Fechar
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <iframe
          ref={ref}
          title="preview"
          sandbox=""
          srcDoc={safe}
          className="mx-auto block h-full min-h-[700px] w-full max-w-[900px] rounded-lg border border-white/10 bg-white shadow-2xl"
        />
      </div>
    </div>
  );
}

export { defaultDocument };
