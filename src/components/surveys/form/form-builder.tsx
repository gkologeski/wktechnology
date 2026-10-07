import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Copy,
  GripVertical,
  Monitor,
  Redo2,
  Smartphone,
  Sparkles,
  Trash2,
  Undo2,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  FIELD_LABEL,
  FIELD_LIBRARY,
  newField,
  validateSchema,
  type FieldType,
  type FormField,
  type FormSchema,
} from "@/lib/surveys/form-schema";
import { getFormDraft, publishForm, saveFormDraft } from "@/lib/surveys/form-builder.functions";
import { FieldProperties } from "./field-properties";
import { FieldControl, FormRenderer } from "./form-renderer";
import { ImportSurveyDialog } from "./import-survey-dialog";

function LibraryItem({ type, onAdd }: { type: FieldType; onAdd: () => void }) {
  const { setNodeRef, attributes, listeners } = useDraggable({ id: `lib:${type}` });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      onClick={onAdd}
      className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
      title="Clique ou arraste para o formulário"
    >
      {FIELD_LABEL[type]}
    </button>
  );
}

function CanvasItem({
  field,
  selected,
  onSelect,
  onLabel,
  onDuplicate,
  onDelete,
  onMove,
  scoring,
}: {
  field: FormField;
  selected: boolean;
  onSelect: () => void;
  onLabel: (l: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (d: -1 | 1) => void;
  scoring: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-canvas-field={field.type}
      className={cn(
        "group relative rounded-md border bg-card p-3 transition-colors",
        selected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border-subtle hover:border-border",
        isDragging && "opacity-60",
        field.type === "page_break" && "border-dashed bg-muted/40",
      )}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.altKey && e.key === "ArrowUp") {
          e.preventDefault();
          onMove(-1);
        }
        if (e.altKey && e.key === "ArrowDown") {
          e.preventDefault();
          onMove(1);
        }
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reordenar ${field.label}. Use Alt + setas`}
          className="cursor-grab rounded p-0.5 text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <GripVertical className="size-4" />
        </button>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {FIELD_LABEL[field.type]}
        </span>
        {field.required && <span className="text-[10px] text-destructive">Obrigatória</span>}
        {scoring && field.scored && (
          <span className="rounded bg-accent px-1.5 text-[10px] text-accent-foreground">
            Pontuada{field.weight && field.weight !== 1 ? ` ×${field.weight}` : ""}
          </span>
        )}
        {field.showIf?.rules.length ? (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <EyeOff className="size-3" />
            Condicional
          </span>
        ) : null}
        {field.source?.confidence === "baixa" && (
          <span className="flex items-center gap-0.5 text-[10px] text-warning">
            <AlertTriangle className="size-3" />
            Revisar
          </span>
        )}
        <div className="ml-auto flex opacity-60 group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Mover para cima"
            onClick={(e) => {
              e.stopPropagation();
              onMove(-1);
            }}
          >
            <ChevronUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Mover para baixo"
            onClick={(e) => {
              e.stopPropagation();
              onMove(1);
            }}
          >
            <ChevronDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={`Duplicar ${field.label}`}
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
          >
            <Copy />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={`Excluir ${field.label}`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      {field.type === "page_break" ? (
        <p className="text-center text-xs text-muted-foreground">— Nova página —</p>
      ) : (
        <>
          <input
            aria-label="Editar enunciado"
            value={field.label}
            onChange={(e) => onLabel(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onFocus={onSelect}
            className="mb-2 w-full rounded bg-transparent text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {!["heading", "paragraph"].includes(field.type) && (
            <div className="pointer-events-none opacity-80" aria-hidden>
              <FieldControl
                field={{ ...field, label: "", description: undefined }}
                value={undefined}
                onChange={() => {}}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });
  return (
    <div
      ref={setNodeRef}
      className={cn("min-h-[200px] space-y-3 rounded-lg p-1", isOver && "bg-accent/40")}
    >
      {children}
    </div>
  );
}

export function FormBuilder({ id }: { id: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getFormDraft);
  const saveFn = useServerFn(saveFormDraft);
  const publishFn = useServerFn(publishForm);
  const q = useQuery({ queryKey: ["survey-builder", id], queryFn: () => getFn({ data: { id } }) });
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "conflict">("idle");
  const [selected, setSelected] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, unknown>>({});
  const [importOpen, setImportOpen] = useState(false);
  const past = useRef<FormSchema[]>([]);
  const future = useRef<FormSchema[]>([]);

  useEffect(() => {
    if (q.data && !schema) {
      setSchema(q.data.schema as unknown as FormSchema);
      setRevision(q.data.revision);
    }
  }, [q.data, schema]);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const update = useCallback((next: FormSchema) => {
    setSchema((cur) => {
      if (cur) {
        past.current = [...past.current.slice(-79), cur];
        future.current = [];
      }
      return next;
    });
    setDirty(true);
  }, []);
  const undo = () => {
    const p = past.current.pop();
    if (p && schema) {
      future.current.push(schema);
      setSchema(p);
      setDirty(true);
    }
  };
  const redo = () => {
    const n = future.current.pop();
    if (n && schema) {
      past.current.push(schema);
      setSchema(n);
      setDirty(true);
    }
  };

  const save = async () => {
    if (!schema) return false;
    setSaving("saving");
    try {
      const r = await saveFn({ data: { id, revision, schema } });
      setRevision(r.revision);
      setDirty(false);
      setSaving("idle");
      toast.success("Rascunho salvo");
      return true;
    } catch (e) {
      const msg = (e as Error).message;
      setSaving(msg.startsWith("CONFLITO") ? "conflict" : "idle");
      toast.error(msg.replace(/^CONFLITO: /, ""));
      return false;
    }
  };
  const publish = async () => {
    if (!schema) return;
    const issues = validateSchema(schema);
    if (issues.length) {
      toast.error(issues[0]!);
      return;
    }
    if (dirty && !(await save())) return;
    try {
      const r = await publishFn({ data: { id, activate: true } });
      toast.success(
        `Versão ${r.version} publicada. Respostas anteriores mantêm a versão em que foram dadas.`,
      );
      void qc.invalidateQueries({ queryKey: ["survey-builder", id] });
      void qc.invalidateQueries({ queryKey: ["survey-activity"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const issues = useMemo(() => (schema ? validateSchema(schema) : []), [schema]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
      if (e.key.toLowerCase() === "z" && !(e.target as HTMLElement).closest("input,textarea")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  if (q.isLoading || (!schema && !q.error))
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid grid-cols-[220px_1fr_320px] gap-4">
          <Skeleton className="h-[60vh]" />
          <Skeleton className="h-[60vh]" />
          <Skeleton className="h-[60vh]" />
        </div>
      </div>
    );
  if (q.error || !schema)
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">
          Não foi possível abrir a pesquisa: {(q.error as Error)?.message}
        </p>
        <Button asChild variant="outline" className="mt-3">
          <Link to="/surveys">Voltar para pesquisas</Link>
        </Button>
      </div>
    );

  const fields = schema.fields;
  const setField = (f: FormField) =>
    update({ ...schema, fields: fields.map((x) => (x.id === f.id ? f : x)) });
  const insert = (type: FieldType, at?: number) => {
    const f = newField(type);
    const i = at ?? (selected ? fields.findIndex((x) => x.id === selected) + 1 : fields.length);
    update({ ...schema, fields: [...fields.slice(0, i), f, ...fields.slice(i)] });
    setSelected(f.id);
  };
  const move = (id2: string, d: -1 | 1) => {
    const i = fields.findIndex((x) => x.id === id2);
    const j = i + d;
    if (j < 0 || j >= fields.length) return;
    update({ ...schema, fields: arrayMove(fields, i, j) });
  };
  const remove = (fid: string) => {
    update({ ...schema, fields: fields.filter((x) => x.id !== fid) });
    setSelected(null);
    toast("Campo excluído", { action: { label: "Desfazer", onClick: undo } });
  };
  const duplicate = (fid: string) => {
    const i = fields.findIndex((x) => x.id === fid);
    const src = fields[i]!;
    const copy: FormField = {
      ...structuredClone(src),
      id: crypto.randomUUID(),
      label: `${src.label} (cópia)`,
      options: src.options?.map((o) => ({ ...o, id: crypto.randomUUID() })),
      rows: src.rows?.map((o) => ({ ...o, id: crypto.randomUUID() })),
    };
    update({ ...schema, fields: [...fields.slice(0, i + 1), copy, ...fields.slice(i + 1)] });
    setSelected(copy.id);
  };
  const onDragEnd = (e: DragEndEvent) => {
    const a = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over) return;
    if (a.startsWith("lib:")) {
      const at = over === "canvas" ? fields.length : fields.findIndex((x) => x.id === over);
      insert(a.slice(4) as FieldType, at < 0 ? fields.length : at);
      return;
    }
    if (a !== over && over !== "canvas")
      update({
        ...schema,
        fields: arrayMove(
          fields,
          fields.findIndex((x) => x.id === a),
          fields.findIndex((x) => x.id === over),
        ),
      });
  };
  const sel = fields.find((f) => f.id === selected) ?? null;
  const groups = Array.from(new Set(FIELD_LIBRARY.map((f) => f.group)));

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col" data-survey-builder>
      <header className="flex flex-wrap items-center gap-2 border-b border-border-subtle bg-background px-4 py-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/surveys">
            <ArrowLeft /> Pesquisas
          </Link>
        </Button>
        <Input
          aria-label="Título da pesquisa"
          value={schema.title}
          onChange={(e) => update({ ...schema, title: e.target.value })}
          className="h-8 max-w-xs border-transparent font-semibold hover:border-input"
        />
        <span
          className={cn(
            "text-xs",
            saving === "conflict"
              ? "text-destructive"
              : dirty
                ? "text-warning"
                : "text-muted-foreground",
          )}
          aria-live="polite"
        >
          {saving === "saving"
            ? "Salvando…"
            : saving === "conflict"
              ? "Conflito: recarregue a página"
              : dirty
                ? "Alterações não salvas"
                : q.data?.publishedVersion
                  ? `Publicada v${q.data.publishedVersion}`
                  : "Rascunho"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Desfazer"
            title="Desfazer (Ctrl+Z)"
            onClick={undo}
          >
            <Undo2 />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refazer"
            title="Refazer (Ctrl+Shift+Z)"
            onClick={redo}
          >
            <Redo2 />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Sparkles /> Importar com IA
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!dirty || saving === "saving"}
            onClick={() => void save()}
          >
            Salvar rascunho
          </Button>
          <Button
            size="sm"
            disabled={saving === "conflict"}
            onClick={() => void publish()}
            title={issues[0]}
          >
            Publicar
          </Button>
        </div>
      </header>
      <Tabs defaultValue="build" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-4 mt-2 self-start">
          <TabsTrigger value="build">Construir</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
          <TabsTrigger value="preview">Pré-visualizar</TabsTrigger>
        </TabsList>
        <TabsContent value="build" className="min-h-0 flex-1">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[200px_1fr] xl:grid-cols-[210px_1fr_320px]">
              <aside
                className="hidden overflow-y-auto border-r border-border-subtle p-3 md:block"
                aria-label="Biblioteca de campos"
              >
                {groups.map((g) => (
                  <div key={g} className="mb-3">
                    <h3 className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {g}
                    </h3>
                    {FIELD_LIBRARY.filter((f) => f.group === g).map((f) => (
                      <LibraryItem key={f.type} type={f.type} onAdd={() => insert(f.type)} />
                    ))}
                  </div>
                ))}
              </aside>
              <main
                className="min-h-0 overflow-y-auto bg-muted/30 p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setSelected(null);
                }}
              >
                <div className="mx-auto max-w-2xl">
                  {issues.length > 0 && (
                    <div
                      className="mb-3 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs"
                      role="status"
                    >
                      <strong>{issues.length} pendência(s) para publicar:</strong>{" "}
                      {issues.slice(0, 3).join(" · ")}
                    </div>
                  )}
                  <DropZone>
                    <SortableContext
                      items={fields.map((f) => f.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {fields.map((f) => (
                        <CanvasItem
                          key={f.id}
                          field={f}
                          scoring={schema.scoringEnabled}
                          selected={selected === f.id}
                          onSelect={() => setSelected(f.id)}
                          onLabel={(label) => setField({ ...f, label })}
                          onDuplicate={() => duplicate(f.id)}
                          onDelete={() => remove(f.id)}
                          onMove={(d) => move(f.id, d)}
                        />
                      ))}
                    </SortableContext>
                    {!fields.length && (
                      <p className="py-16 text-center text-sm text-muted-foreground">
                        Arraste campos da biblioteca ou clique para adicionar.
                      </p>
                    )}
                  </DropZone>
                  <div className="mt-3 flex flex-wrap gap-1 md:hidden">
                    {FIELD_LIBRARY.slice(0, 8).map((f) => (
                      <Button
                        key={f.type}
                        size="sm"
                        variant="outline"
                        onClick={() => insert(f.type)}
                      >
                        {f.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </main>
              <aside
                className="overflow-y-auto border-l border-border-subtle p-4 max-xl:border-t xl:block"
                aria-label="Propriedades do campo"
              >
                {sel ? (
                  <FieldProperties schema={schema} field={sel} onChange={setField} />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Selecione um campo para editar suas propriedades.
                  </p>
                )}
              </aside>
            </div>
          </DndContext>
        </TabsContent>
        <TabsContent value="settings" className="overflow-y-auto p-6">
          <div className="mx-auto max-w-xl space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="sv-desc">Descrição exibida ao respondente</Label>
              <Textarea
                id="sv-desc"
                value={schema.description ?? ""}
                onChange={(e) => update({ ...schema, description: e.target.value || undefined })}
              />
            </div>
            <div className="flex items-start justify-between gap-4 rounded-md border border-border-subtle p-4">
              <div>
                <Label htmlFor="sv-score">Pesquisa com pontuação</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Desligado: nenhuma resposta gera nota. Ligado: só perguntas marcadas como
                  “pontuar” entram na soma; as demais ficam sem nota.
                </p>
              </div>
              <Switch
                id="sv-score"
                checked={schema.scoringEnabled}
                onCheckedChange={(scoringEnabled) => update({ ...schema, scoringEnabled })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Publicar cria uma nova versão; respostas antigas continuam ligadas à versão
              respondida. Publicar não envia a pesquisa a ninguém.
            </p>
          </div>
        </TabsContent>
        <TabsContent value="preview" className="overflow-y-auto p-6">
          <div className="mb-4 flex justify-center gap-1">
            <Button
              size="sm"
              variant={device === "desktop" ? "default" : "outline"}
              aria-pressed={device === "desktop"}
              onClick={() => setDevice("desktop")}
            >
              <Monitor /> Desktop
            </Button>
            <Button
              size="sm"
              variant={device === "mobile" ? "default" : "outline"}
              aria-pressed={device === "mobile"}
              onClick={() => setDevice("mobile")}
            >
              <Smartphone /> Celular
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPreviewAnswers({})}>
              Limpar respostas
            </Button>
          </div>
          <div
            className={cn(
              "mx-auto rounded-lg border border-border-subtle bg-card p-6 shadow-sm",
              device === "mobile" ? "max-w-[390px]" : "max-w-2xl",
            )}
            data-preview={device}
          >
            <h2 className="text-lg font-semibold">{schema.title}</h2>
            {schema.description && (
              <p className="mb-4 mt-1 text-sm text-muted-foreground">{schema.description}</p>
            )}
            <FormRenderer schema={schema} answers={previewAnswers} onChange={setPreviewAnswers} />
          </div>
        </TabsContent>
      </Tabs>
      <ImportSurveyDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        currentTitle={schema.title}
        onAppend={(imported) => {
          update({ ...schema, fields: [...fields, ...imported.fields] });
          toast.success(`${imported.fields.length} campos adicionados ao rascunho`);
        }}
      />
    </div>
  );
}
