import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getLandingPage, saveLandingPage } from "@/lib/landing-pages.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  Eye,
  Settings,
  Plus,
  Trash2,
  Copy,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { BLOCKS, REGISTRY, type Block } from "./blocks";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Status = "draft" | "published" | "archived";
type PageData = {
  title: string;
  slug: string;
  description: string | null;
  status: Status;
  blocks: Block[];
  theme: Record<string, unknown>;
  seo: Record<string, unknown>;
};

const DEVICE_WIDTHS: Record<string, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

export function LandingPageEditor({ id }: { id: string }) {
  const fetchPage = useServerFn(getLandingPage);
  const save = useServerFn(saveLandingPage);
  const nav = useNavigate();
  const { data } = useQuery({
    queryKey: ["lp", id],
    queryFn: () => fetchPage({ data: { id } }),
  });

  const [state, setState] = useState<PageData | null>(null);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [selected, setSelected] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // history (undo/redo)
  const history = useRef<PageData[]>([]);
  const future = useRef<PageData[]>([]);

  // hydrate
  useEffect(() => {
    if (data?.page && !state) {
      const p = data.page as PageData;
      setState({
        title: p.title,
        slug: p.slug,
        description: p.description ?? "",
        status: (p.status as Status) ?? "draft",
        blocks: p.blocks ?? [],
        theme: p.theme ?? {},
        seo: p.seo ?? {},
      });
    }
  }, [data, state]);

  // commit state change with history push
  const commit = useCallback((next: PageData) => {
    setState((prev) => {
      if (prev) history.current.push(prev);
      if (history.current.length > 50) history.current.shift();
      future.current = [];
      return next;
    });
  }, []);

  const undo = () => {
    setState((prev) => {
      const last = history.current.pop();
      if (!last || !prev) return prev;
      future.current.push(prev);
      return last;
    });
  };
  const redo = () => {
    setState((prev) => {
      const next = future.current.pop();
      if (!next || !prev) return prev;
      history.current.push(prev);
      return next;
    });
  };

  // Autosave
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!state) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await save({
          data: {
            id,
            title: state.title,
            slug: state.slug,
            description: state.description ?? "",
            status: state.status,
            blocks: state.blocks,
            theme: state.theme,
            seo: state.seo,
          },
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      } catch (e) {
        setSaveStatus("idle");
        toast.error((e as Error).message);
      }
    }, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  if (!state) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  function updateBlock(idx: number, patch: Partial<Block>) {
    if (!state) return;
    const next = [...state.blocks];
    next[idx] = { ...next[idx], ...patch };
    commit({ ...state, blocks: next });
  }
  function addBlock(type: string, atIndex?: number) {
    if (!state) return;
    const def = REGISTRY[type];
    if (!def) return;
    const next = [...state.blocks];
    const insertAt = atIndex ?? next.length;
    next.splice(insertAt, 0, JSON.parse(JSON.stringify(def.defaults)));
    commit({ ...state, blocks: next });
    setSelected(insertAt);
    setPickerOpen(false);
  }
  function removeBlock(idx: number) {
    if (!state) return;
    commit({ ...state, blocks: state.blocks.filter((_, i) => i !== idx) });
    setSelected(null);
  }
  function duplicateBlock(idx: number) {
    if (!state) return;
    const next = [...state.blocks];
    next.splice(idx + 1, 0, JSON.parse(JSON.stringify(state.blocks[idx])));
    commit({ ...state, blocks: next });
  }
  function moveBlock(idx: number, dir: -1 | 1) {
    if (!state) return;
    const j = idx + dir;
    if (j < 0 || j >= state.blocks.length) return;
    const next = arrayMove(state.blocks, idx, j);
    commit({ ...state, blocks: next });
    setSelected(j);
  }
  function onDragEnd(e: DragEndEvent) {
    if (!state || !e.over || e.active.id === e.over.id) return;
    const from = state.blocks.findIndex((_, i) => String(i) === e.active.id);
    const to = state.blocks.findIndex((_, i) => String(i) === e.over!.id);
    if (from < 0 || to < 0) return;
    commit({ ...state, blocks: arrayMove(state.blocks, from, to) });
    setSelected(to);
  }

  const selectedBlock = selected != null ? state.blocks[selected] : null;
  const SelectedProps = selectedBlock ? REGISTRY[selectedBlock.type]?.Properties : null;

  return (
    <div className="h-screen flex flex-col bg-muted/30 overflow-hidden">
      {/* TOPBAR */}
      <header className="h-14 border-b border-border bg-background flex items-center px-3 gap-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/landing-pages" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="h-6 w-px bg-border mx-1" />
        <Input
          className="w-64 h-8 border-transparent hover:border-border focus:border-border font-medium"
          value={state.title}
          onChange={(e) => commit({ ...state, title: e.target.value })}
        />
        <Badge
          variant={state.status === "published" ? "default" : "secondary"}
          className="capitalize"
        >
          {state.status === "draft"
            ? "Rascunho"
            : state.status === "published"
              ? "Publicada"
              : "Arquivada"}
        </Badge>

        <div className="flex-1 flex items-center justify-center gap-1">
          <Button
            size="sm"
            variant={device === "desktop" ? "secondary" : "ghost"}
            onClick={() => setDevice("desktop")}
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={device === "tablet" ? "secondary" : "ghost"}
            onClick={() => setDevice("tablet")}
          >
            <Tablet className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={device === "mobile" ? "secondary" : "ghost"}
            onClick={() => setDevice("mobile")}
          >
            <Smartphone className="h-4 w-4" />
          </Button>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={undo}
          disabled={history.current.length === 0}
          title="Desfazer (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={redo}
          disabled={future.current.length === 0}
          title="Refazer (Ctrl+Y)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>

        <div className="text-xs text-muted-foreground min-w-20 text-center">
          {saveStatus === "saving" ? (
            <span className="flex items-center gap-1 justify-center">
              <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
            </span>
          ) : saveStatus === "saved" ? (
            <span className="flex items-center gap-1 justify-center text-green-600">
              <Check className="h-3 w-3" /> Salvo
            </span>
          ) : null}
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open(`/lp/${state.slug}`, "_blank")}
        >
          <Eye className="h-4 w-4 mr-1" /> Preview
        </Button>
        <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
          <Settings className="h-4 w-4 mr-1" /> Configurações
        </Button>
        <Button
          size="sm"
          onClick={() => {
            commit({ ...state, status: state.status === "published" ? "draft" : "published" });
            toast.success(state.status === "published" ? "Despublicada" : "Publicada");
          }}
        >
          {state.status === "published" ? "Despublicar" : "Publicar"}
        </Button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: MODULES */}
        <aside className="w-56 border-r border-border bg-background overflow-y-auto p-3 shrink-0">
          <div className="text-xs font-semibold text-muted-foreground uppercase mb-2 px-1">
            Módulos
          </div>
          <div className="grid grid-cols-2 gap-2">
            {BLOCKS.map((b) => {
              const Icon = b.icon;
              return (
                <button
                  key={b.type}
                  onClick={() => addBlock(b.type)}
                  className="border border-border rounded-md p-3 hover:border-primary hover:bg-primary/5 transition flex flex-col items-center gap-1 text-center"
                >
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs">{b.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* CENTER: CANVAS */}
        <main className="flex-1 overflow-y-auto p-6" onClick={() => setSelected(null)}>
          <div
            className="mx-auto bg-background border border-border rounded-lg shadow-sm transition-all min-h-full"
            style={{ width: DEVICE_WIDTHS[device], maxWidth: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            {state.blocks.length === 0 ? (
              <div className="py-32 text-center text-muted-foreground">
                <p className="mb-4">Sua página está vazia.</p>
                <Button onClick={() => setPickerOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar primeiro bloco
                </Button>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={state.blocks.map((_, i) => String(i))}
                  strategy={verticalListSortingStrategy}
                >
                  {state.blocks.map((block, i) => (
                    <SortableBlock
                      key={i}
                      id={String(i)}
                      block={block}
                      selected={selected === i}
                      onSelect={() => setSelected(i)}
                      onInlineEdit={(patch) => updateBlock(i, patch)}
                      onRemove={() => removeBlock(i)}
                      onDuplicate={() => duplicateBlock(i)}
                      onMoveUp={() => moveBlock(i, -1)}
                      onMoveDown={() => moveBlock(i, 1)}
                      canMoveUp={i > 0}
                      canMoveDown={i < state.blocks.length - 1}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}

            {state.blocks.length > 0 && (
              <div className="p-6 border-t border-dashed border-border">
                <Button variant="outline" className="w-full" onClick={() => setPickerOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar bloco
                </Button>
              </div>
            )}
          </div>
        </main>

        {/* RIGHT: PROPERTIES */}
        <aside className="w-80 border-l border-border bg-background overflow-y-auto shrink-0">
          {selectedBlock && SelectedProps ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Bloco</div>
                  <div className="font-semibold">{REGISTRY[selectedBlock.type].label}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                  ×
                </Button>
              </div>
              <div className="space-y-4">
                <SelectedProps
                  block={selectedBlock}
                  onChange={(patch) => updateBlock(selected!, patch)}
                />
              </div>
            </div>
          ) : (
            <div className="p-6 text-sm text-muted-foreground text-center">
              <p>Clique em um bloco no canvas para editar suas propriedades.</p>
            </div>
          )}
        </aside>
      </div>

      {/* Block picker */}
      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle>Escolha um bloco</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {BLOCKS.map((b) => {
              const Icon = b.icon;
              return (
                <button
                  key={b.type}
                  onClick={() => addBlock(b.type)}
                  className="border border-border rounded-md p-4 hover:border-primary hover:bg-primary/5 transition flex flex-col items-center gap-2"
                >
                  <Icon className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm">{b.label}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Settings drawer */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent className="w-[400px] sm:max-w-[400px]">
          <SheetHeader>
            <SheetTitle>Configurações da página</SheetTitle>
          </SheetHeader>
          <Tabs defaultValue="seo" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="seo">SEO</TabsTrigger>
              <TabsTrigger value="theme">Tema</TabsTrigger>
              <TabsTrigger value="advanced">Avançado</TabsTrigger>
            </TabsList>
            <TabsContent value="seo" className="space-y-3 mt-4">
              <div>
                <Label>Título da página</Label>
                <Input
                  value={state.title}
                  onChange={(e) => commit({ ...state, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Slug (URL)</Label>
                <Input
                  value={state.slug}
                  onChange={(e) =>
                    commit({
                      ...state,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">URL pública: /lp/{state.slug}</p>
              </div>
              <div>
                <Label>Meta descrição</Label>
                <Textarea
                  value={state.description ?? ""}
                  rows={3}
                  onChange={(e) => commit({ ...state, description: e.target.value })}
                />
              </div>
            </TabsContent>
            <TabsContent value="theme" className="space-y-3 mt-4">
              <div>
                <Label>Cor primária</Label>
                <Input
                  type="color"
                  value={String((state.theme.primaryColor as string) ?? "#3b82f6")}
                  onChange={(e) =>
                    commit({ ...state, theme: { ...state.theme, primaryColor: e.target.value } })
                  }
                  className="h-10 w-20"
                />
              </div>
              <div>
                <Label>Cor de fundo</Label>
                <Input
                  type="color"
                  value={String((state.theme.bgColor as string) ?? "#ffffff")}
                  onChange={(e) =>
                    commit({ ...state, theme: { ...state.theme, bgColor: e.target.value } })
                  }
                  className="h-10 w-20"
                />
              </div>
              <div>
                <Label>Fonte</Label>
                <Select
                  value={String((state.theme.font as string) ?? "system")}
                  onValueChange={(v) => commit({ ...state, theme: { ...state.theme, font: v } })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">Sistema</SelectItem>
                    <SelectItem value="serif">Serifa (elegante)</SelectItem>
                    <SelectItem value="mono">Monoespaçada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
            <TabsContent value="advanced" className="space-y-3 mt-4">
              <div>
                <Label>Status</Label>
                <Select
                  value={state.status}
                  onValueChange={(v) => commit({ ...state, status: v as Status })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="published">Publicada</SelectItem>
                    <SelectItem value="archived">Arquivada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SortableBlock({
  id,
  block,
  selected,
  onSelect,
  onInlineEdit,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  id: string;
  block: Block;
  selected: boolean;
  onSelect: () => void;
  onInlineEdit: (patch: Partial<Block>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const def = REGISTRY[block.type];
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  if (!def) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="p-4 border border-dashed border-destructive text-destructive text-sm"
      >
        Tipo de bloco desconhecido: {block.type}
      </div>
    );
  }
  const Render = def.Render;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${selected ? "ring-2 ring-primary ring-inset" : "hover:ring-1 hover:ring-primary/40 hover:ring-inset"}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Floating toolbar */}
      <div
        className={`absolute top-2 right-2 z-10 flex items-center gap-1 bg-background border border-border rounded-md shadow-sm p-1 ${
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        } transition`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          {...attributes}
          {...listeners}
          className="p-1 cursor-grab hover:bg-muted rounded"
          title="Arrastar"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="p-1 hover:bg-muted rounded disabled:opacity-30"
          title="Mover acima"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="p-1 hover:bg-muted rounded disabled:opacity-30"
          title="Mover abaixo"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button onClick={onDuplicate} className="p-1 hover:bg-muted rounded" title="Duplicar">
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onRemove}
          className="p-1 hover:bg-destructive/10 hover:text-destructive rounded"
          title="Remover"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* Block type label */}
      <div
        className={`absolute top-2 left-2 z-10 text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded ${
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        } transition`}
      >
        {def.label}
      </div>
      <Render block={block} editable onInlineEdit={onInlineEdit} />
    </div>
  );
}
