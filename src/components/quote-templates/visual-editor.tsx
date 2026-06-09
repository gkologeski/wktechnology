import { useEffect, useMemo, useState } from "react";
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
  type BlockType,
  type TemplateBlock,
  type TemplateDocument,
} from "@/lib/quote-template-blocks";
import { renderQuoteTemplate, sampleQuoteContext } from "@/lib/quote-template-renderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Calculator,
  Copy,
  Eye,
  FileText,
  GripVertical,
  Heading,
  Image as ImageIcon,
  Minus,
  MousePointerClick,
  MoveVertical,
  StickyNote,
  Table as TableIcon,
  Trash2,
  Type,
  UserCheck,
  Users,
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
  const [selectedId, setSelectedId] = useState<string | null>(doc.blocks[0]?.id ?? null);
  const [dragging, setDragging] = useState<{ kind: "palette" | "block"; payload: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const selectedBlock = doc.blocks.find((b) => b.id === selectedId) ?? null;

  const updateBlocks = (blocks: TemplateBlock[]) => onChange({ ...doc, blocks });
  const updateBlock = (id: string, patch: Partial<TemplateBlock>) => {
    updateBlocks(doc.blocks.map((b) => (b.id === id ? { ...b, ...patch, props: { ...b.props, ...(patch.props ?? {}) } } : b)));
  };
  const removeBlock = (id: string) => {
    updateBlocks(doc.blocks.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };
  const duplicateBlock = (id: string) => {
    const idx = doc.blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const copy = { ...doc.blocks[idx], id: `b_${Math.random().toString(36).slice(2, 10)}`, props: { ...doc.blocks[idx].props } };
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
      if (overId !== "canvas") {
        const idx = doc.blocks.findIndex((b) => b.id === overId);
        if (idx >= 0) insertIndex = idx + 1;
      }
      addBlock(type, insertIndex);
      return;
    }

    // Block sortable inside canvas
    if (activeId !== overId) {
      const from = doc.blocks.findIndex((b) => b.id === activeId);
      const to = doc.blocks.findIndex((b) => b.id === overId);
      if (from >= 0 && to >= 0) updateBlocks(arrayMove(doc.blocks, from, to));
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
        {/* Palette */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Blocos</div>
          <div className="space-y-1.5">
            {BLOCK_LIBRARY.map((b) => (
              <PaletteItem key={b.type} type={b.type} label={b.label} description={b.description} icon={b.icon} onAdd={() => addBlock(b.type)} />
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Conteúdo</div>
            <Button size="sm" variant="outline" onClick={() => setShowPreview((v) => !v)}>
              <Eye className="h-3.5 w-3.5 mr-1" /> {showPreview ? "Ocultar" : "Visualizar"} preview
            </Button>
          </div>
          <Canvas
            blocks={doc.blocks}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRemove={removeBlock}
            onDuplicate={duplicateBlock}
          />
          {showPreview && <PreviewPane doc={doc} />}
        </div>

        {/* Inspector */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Propriedades</div>
          <div className="rounded-lg border bg-card p-3 space-y-3">
            {selectedBlock ? (
              <Inspector
                block={selectedBlock}
                onChange={(patch) => updateBlock(selectedBlock.id, patch)}
                onRemove={() => removeBlock(selectedBlock.id)}
              />
            ) : (
              <ThemeInspector
                theme={doc.theme}
                onChange={(theme) => onChange({ ...doc, theme })}
              />
            )}
          </div>
        </div>
      </div>

      <DragOverlay>
        {dragging && dragging.kind === "palette" ? (
          <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-lg">
            {BLOCK_LIBRARY.find((b) => b.type === dragging.payload)?.label ?? dragging.payload}
          </div>
        ) : dragging && dragging.kind === "block" ? (
          <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-lg opacity-90">
            Movendo bloco…
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function PaletteItem({
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
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 rounded-md border bg-card p-2 text-sm cursor-grab active:cursor-grabbing transition-colors hover:border-primary/60 ${isDragging ? "opacity-40" : ""}`}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{label}</div>
        <div className="text-[11px] text-muted-foreground truncate">{description}</div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 px-2 text-[11px]"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
      >
        +
      </Button>
    </div>
  );
}

function Canvas({
  blocks,
  selectedId,
  onSelect,
  onRemove,
  onDuplicate,
}: {
  blocks: TemplateBlock[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[420px] rounded-lg border-2 border-dashed p-3 transition-colors ${isOver ? "border-primary bg-primary/5" : "border-border bg-muted/30"}`}
    >
      {blocks.length === 0 ? (
        <div className="flex h-[380px] items-center justify-center text-sm text-muted-foreground text-center px-6">
          Arraste blocos da lateral esquerda ou clique no botão "+" para começar.
        </div>
      ) : (
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {blocks.map((b) => (
              <SortableBlock
                key={b.id}
                block={b}
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

function SortableBlock({
  block,
  selected,
  onSelect,
  onRemove,
  onDuplicate,
}: {
  block: TemplateBlock;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const def = BLOCK_LIBRARY.find((b) => b.type === block.type);
  const Icon = ICONS[def?.icon ?? "Type"] ?? Type;

  const summary = blockSummary(block);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group flex items-center gap-2 rounded-md border bg-card px-2 py-2 text-sm cursor-pointer transition-shadow ${selected ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/50"} ${isDragging ? "opacity-60 shadow-lg" : ""}`}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        {...listeners}
        {...attributes}
        onClick={(e) => e.stopPropagation()}
        aria-label="Arrastar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{def?.label ?? block.type}</div>
        {summary && <div className="text-[11px] text-muted-foreground truncate">{summary}</div>}
      </div>
      <Badge variant="outline" className="text-[10px] opacity-0 group-hover:opacity-100">{block.type}</Badge>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate();
        }}
        title="Duplicar"
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="Remover"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function blockSummary(b: TemplateBlock): string {
  switch (b.type) {
    case "header":
      return String(b.props.title ?? "");
    case "text":
      return String(b.props.content ?? "").slice(0, 80);
    case "image":
    case "logo":
      return String(b.props.url ?? "") || "(sem URL)";
    case "spacer":
      return `${b.props.height ?? 24}px`;
    default:
      return "";
  }
}

function Inspector({
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
  const def = BLOCK_LIBRARY.find((b) => b.type === block.type);

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{def?.label ?? block.type}</div>
          <div className="text-[11px] text-muted-foreground">{def?.description}</div>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onRemove} title="Remover">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <Separator />

      {block.type === "header" && (
        <>
          <Field label="Título"><Input value={String(p.title ?? "")} onChange={(e) => setProp("title", e.target.value)} /></Field>
          <Field label="Subtítulo"><Input value={String(p.subtitle ?? "")} onChange={(e) => setProp("subtitle", e.target.value)} /></Field>
          <Field label="Alinhamento"><SelectGroup value={String(p.align ?? "left")} options={[["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]]} onChange={(v) => setProp("align", v)} /></Field>
          <Field label="Cor de fundo (opcional)"><Input type="color" value={String(p.bg || "#ffffff")} onChange={(e) => setProp("bg", e.target.value)} /></Field>
          <Button size="sm" variant="outline" onClick={() => setProp("bg", "")}>Sem fundo</Button>
        </>
      )}

      {block.type === "logo" && (
        <>
          <Field label="URL da imagem"><Input value={String(p.url ?? "")} onChange={(e) => setProp("url", e.target.value)} placeholder="https://..." /></Field>
          <Field label="Largura (px)"><Input type="number" value={Number(p.width ?? 140)} onChange={(e) => setProp("width", Number(e.target.value))} /></Field>
          <Field label="Alinhamento"><SelectGroup value={String(p.align ?? "left")} options={[["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]]} onChange={(v) => setProp("align", v)} /></Field>
        </>
      )}

      {block.type === "customer" && (
        <>
          <Field label="Título"><Input value={String(p.title ?? "Para")} onChange={(e) => setProp("title", e.target.value)} /></Field>
          <ToggleField label="Mostrar nome da empresa" checked={Boolean(p.showCompany)} onChange={(v) => setProp("showCompany", v)} />
          <ToggleField label="Mostrar contato" checked={Boolean(p.showContact)} onChange={(v) => setProp("showContact", v)} />
          <ToggleField label="Mostrar e-mail" checked={Boolean(p.showEmail)} onChange={(v) => setProp("showEmail", v)} />
        </>
      )}

      {block.type === "agent" && (
        <>
          <Field label="Título"><Input value={String(p.title ?? "Emissor")} onChange={(e) => setProp("title", e.target.value)} /></Field>
          <ToggleField label="Mostrar vendedor" checked={Boolean(p.showAgent)} onChange={(v) => setProp("showAgent", v)} />
          <ToggleField label="Data de emissão" checked={Boolean(p.showCreated)} onChange={(v) => setProp("showCreated", v)} />
          <ToggleField label="Validade" checked={Boolean(p.showValidity)} onChange={(v) => setProp("showValidity", v)} />
        </>
      )}

      {block.type === "items_table" && (
        <>
          <ToggleField label="Coluna descrição" checked={Boolean(p.showDescription)} onChange={(v) => setProp("showDescription", v)} />
          <ToggleField label="Coluna desconto" checked={Boolean(p.showDiscount)} onChange={(v) => setProp("showDiscount", v)} />
          <ToggleField label="Coluna imposto" checked={Boolean(p.showTax)} onChange={(v) => setProp("showTax", v)} />
          <Field label="Cor do cabeçalho"><Input type="color" value={String(p.headerBg === "auto" || !p.headerBg ? "#4f46e5" : p.headerBg)} onChange={(e) => setProp("headerBg", e.target.value)} /></Field>
          <Button size="sm" variant="outline" onClick={() => setProp("headerBg", "auto")}>Usar cor primária do tema</Button>
        </>
      )}

      {block.type === "totals" && (
        <>
          <ToggleField label="Subtotal" checked={Boolean(p.showSubtotal)} onChange={(v) => setProp("showSubtotal", v)} />
          <ToggleField label="Descontos" checked={Boolean(p.showDiscount)} onChange={(v) => setProp("showDiscount", v)} />
          <ToggleField label="Impostos" checked={Boolean(p.showTax)} onChange={(v) => setProp("showTax", v)} />
          <Field label="Alinhamento"><SelectGroup value={String(p.align ?? "right")} options={[["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]]} onChange={(v) => setProp("align", v)} /></Field>
        </>
      )}

      {(block.type === "notes" || block.type === "terms") && (
        <Field label="Título"><Input value={String(p.title ?? "")} onChange={(e) => setProp("title", e.target.value)} /></Field>
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
          <Field label="Alinhamento"><SelectGroup value={String(p.align ?? "left")} options={[["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]]} onChange={(v) => setProp("align", v)} /></Field>
        </>
      )}

      {block.type === "spacer" && (
        <Field label="Altura (px)"><Input type="number" value={Number(p.height ?? 24)} onChange={(e) => setProp("height", Number(e.target.value))} /></Field>
      )}

      {block.type === "image" && (
        <>
          <Field label="URL"><Input value={String(p.url ?? "")} onChange={(e) => setProp("url", e.target.value)} placeholder="https://..." /></Field>
          <Field label="Largura (px)"><Input type="number" value={Number(p.width ?? 480)} onChange={(e) => setProp("width", Number(e.target.value))} /></Field>
          <Field label="Alinhamento"><SelectGroup value={String(p.align ?? "center")} options={[["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]]} onChange={(v) => setProp("align", v)} /></Field>
        </>
      )}

      {(block.type === "actions" || block.type === "divider") && (
        <p className="text-xs text-muted-foreground">Este bloco não possui configurações.</p>
      )}
    </div>
  );
}

function ThemeInspector({ theme, onChange }: { theme: TemplateDocument["theme"]; onChange: (t: TemplateDocument["theme"]) => void }) {
  const set = (patch: Partial<TemplateDocument["theme"]>) => onChange({ ...theme, ...patch });
  return (
    <div className="space-y-3 text-sm">
      <div className="text-xs text-muted-foreground">Selecione um bloco para editá-lo, ou ajuste o tema geral abaixo.</div>
      <Separator />
      <Field label="Cor primária"><Input type="color" value={theme.primaryColor} onChange={(e) => set({ primaryColor: e.target.value })} /></Field>
      <Field label="Cor de fundo"><Input type="color" value={theme.bgColor} onChange={(e) => set({ bgColor: e.target.value })} /></Field>
      <Field label="Cor do texto"><Input type="color" value={theme.textColor} onChange={(e) => set({ textColor: e.target.value })} /></Field>
      <Field label="Fonte">
        <SelectGroup
          value={theme.fontFamily}
          options={[
            ["'Inter', system-ui, sans-serif", "Inter (sans-serif)"],
            ["Georgia, 'Times New Roman', serif", "Georgia (serif)"],
            ["'Helvetica Neue', Arial, sans-serif", "Helvetica"],
            ["'Courier New', monospace", "Courier"],
          ]}
          onChange={(v) => set({ fontFamily: v })}
        />
      </Field>
      <Field label="Espaçamento da página (px)"><Input type="number" value={theme.pagePadding} onChange={(e) => set({ pagePadding: Number(e.target.value) })} /></Field>
      <Field label="Raio dos cantos (px)"><Input type="number" value={theme.radius} onChange={(e) => set({ radius: Number(e.target.value) })} /></Field>
      <Button size="sm" variant="outline" onClick={() => onChange({ ...DEFAULT_THEME })}>Restaurar tema padrão</Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-[12px]">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SelectGroup({ value, options, onChange }: { value: string; options: Array<[string, string]>; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([val, label]) => (
        <button
          key={val}
          type="button"
          onClick={() => onChange(val)}
          className={`rounded-md border px-2 py-1 text-xs ${value === val ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function PreviewPane({ doc }: { doc: TemplateDocument }) {
  const html = useMemo(() => blocksToHtml(doc), [doc]);
  const [safe, setSafe] = useState("");
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
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pré-visualização (dados de exemplo)</div>
      <iframe title="preview" sandbox="" srcDoc={safe} className="w-full min-h-[600px] rounded border bg-white" />
    </div>
  );
}

export { defaultDocument };
