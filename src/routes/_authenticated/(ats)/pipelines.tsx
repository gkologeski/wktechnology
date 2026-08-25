// Editor visual de pipelines (etapas) do ATS.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GitBranch, Plus, Trash2, GripVertical, Star, Save, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  listAtsPipelines,
  ensureDefaultAtsPipeline,
  savePipeline,
  deletePipeline,
  setDefaultPipeline,
} from "@/lib/ats/pipelines.functions";
import { DEFAULT_ATS_STAGES, type AtsStage } from "@/lib/ats/stages";
import { AtsPageHeader, AtsSectionHeader, EmptyState, Skeletons } from "@/components/ats/ui";
import { MetaPill } from "@/components/techhire/ui";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/_authenticated/(ats)/pipelines")({
  component: PipelinesPage,
});

type Pipeline = {
  id: string;
  name: string;
  is_default: boolean;
  stages: AtsStage[];
};

const STAGE_TYPES: { value: AtsStage["type"]; label: string }[] = [
  { value: "open", label: "Em andamento" },
  { value: "won", label: "Ganho (contratado)" },
  { value: "lost", label: "Perdido (rejeitado)" },
];

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "")
    .slice(0, 50);
}

function PipelinesSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
      <Skeletons.Card lines={4} />
      <Skeletons.Card lines={8} />
    </div>
  );
}

function PipelinesPage() {
  const list = useServerFn(listAtsPipelines);
  const ensureDefault = useServerFn(ensureDefaultAtsPipeline);
  const save = useServerFn(savePipeline);
  const del = useServerFn(deletePipeline);
  const setDef = useServerFn(setDefaultPipeline);
  const qc = useQueryClient();

  const {
    data: pipelines = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["ats-pipelines"],
    queryFn: async () => {
      // garante um único pipeline padrão do workspace (idempotente)
      await ensureDefault().catch(() => undefined);
      return (await list()) as unknown as Pipeline[];
    },
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [stages, setStages] = useState<AtsStage[]>([]);

  useEffect(() => {
    if (!pipelines.length) return;
    if (!selectedId || !pipelines.find((p) => p.id === selectedId)) {
      setSelectedId(pipelines[0].id);
    }
  }, [pipelines, selectedId]);

  useEffect(() => {
    const p = pipelines.find((x) => x.id === selectedId);
    if (p) {
      setName(p.name);
      setIsDefault(p.is_default);
      setStages((p.stages ?? []).map((s) => ({ ...s, type: s.type ?? "open" })));
    }
  }, [selectedId, pipelines]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = stages.findIndex((s) => s.value === active.id);
    const newIndex = stages.findIndex((s) => s.value === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setStages(arrayMove(stages, oldIndex, newIndex));
  };

  const addStage = () => {
    const base = `nova_etapa_${stages.length + 1}`;
    setStages([
      ...stages,
      { value: base, label: "Nova etapa", color: "var(--hs-stage-2)", type: "open" },
    ]);
  };

  const updateStage = (idx: number, patch: Partial<AtsStage>) => {
    const next = [...stages];
    next[idx] = { ...next[idx], ...patch };
    setStages(next);
  };

  const removeStage = (idx: number) => {
    if (stages.length <= 2) {
      toast.error("Pipeline precisa de no mínimo 2 etapas");
      return;
    }
    setStages(stages.filter((_, i) => i !== idx));
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const cleaned = stages.map((s) => ({
        ...s,
        value: slug(s.value || s.label),
        label: s.label.trim() || s.value,
        type: s.type ?? "open",
      }));
      return save({
        data: {
          id: selectedId ?? undefined,
          name: name.trim(),
          is_default: isDefault,
          stages: cleaned,
        },
      });
    },
    onSuccess: () => {
      toast.success("Pipeline salvo");
      qc.invalidateQueries({ queryKey: ["ats-pipelines"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const newPipeline = () => {
    setSelectedId(null);
    setName("Novo pipeline");
    setIsDefault(false);
    setStages(DEFAULT_ATS_STAGES.map((s) => ({ ...s })));
  };

  const duplicate = () => {
    setSelectedId(null);
    setName(`${name} (cópia)`);
    setIsDefault(false);
  };

  const deleteMut = useMutation({
    mutationFn: () => del({ data: { id: selectedId! } }),
    onSuccess: () => {
      toast.success("Pipeline excluído");
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["ats-pipelines"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDefMut = useMutation({
    mutationFn: () => setDef({ data: { id: selectedId! } }),
    onSuccess: () => {
      toast.success("Pipeline definido como padrão");
      qc.invalidateQueries({ queryKey: ["ats-pipelines"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const summary = useMemo(() => {
    const open = stages.filter((s) => (s.type ?? "open") === "open").length;
    const won = stages.filter((s) => s.type === "won").length;
    const lost = stages.filter((s) => s.type === "lost").length;
    return { open, won, lost };
  }, [stages]);

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <AtsPageHeader
        eyebrow="Configurações"
        title="Pipelines de recrutamento"
        description="Crie, reordene e personalize as etapas de cada funil. Arraste para reordenar."
        primaryAction={
          <Button onClick={newPipeline}>
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            Novo pipeline
          </Button>
        }
      />

      {isLoading ? (
        <PipelinesSkeleton />
      ) : error ? (
        <EmptyState
          icon={GitBranch}
          title="Não foi possível carregar pipelines"
          description={error instanceof Error ? error.message : "Erro desconhecido"}
          action={<Button onClick={() => refetch()}>Tentar novamente</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
          {/* Sidebar — lista de pipelines */}
          <section className="rounded-lg border border-border-subtle bg-surface-1 shadow-xs flex flex-col">
            <div className="px-3 py-2.5 border-b border-border-subtle">
              <AtsSectionHeader title="Pipelines" />
            </div>
            <div className="flex flex-col gap-1 p-2">
              {pipelines.length === 0 ? (
                <EmptyState
                  compact
                  icon={GitBranch}
                  title="Nenhum pipeline visível"
                  description="Não há pipeline visível para você. Se este workspace já possui pipelines, peça a um administrador acesso de visualização de pipelines; caso contrário, crie o primeiro."
                  action={
                    <Button size="sm" onClick={newPipeline}>
                      <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                      Novo
                    </Button>
                  }
                />
              ) : (
                pipelines.map((p) => {
                  const active = selectedId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      aria-pressed={active}
                      className={cn(
                        "text-left px-3 py-2 rounded-md text-sm transition-colors",
                        "border border-transparent",
                        "hover:bg-surface-sunken",
                        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                        active && "bg-surface-sunken border-border-subtle",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex-1 truncate font-medium text-text-primary">
                          {p.name}
                        </span>
                        {p.is_default && (
                          <MetaPill>
                            <Star className="h-3 w-3 mr-0.5" aria-hidden="true" />
                            padrão
                          </MetaPill>
                        )}
                      </div>
                      <div className="text-xs text-text-tertiary mt-0.5">
                        {p.stages?.length ?? 0} etapas
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* Editor */}
          <section className="rounded-lg border border-border-subtle bg-surface-1 shadow-xs">
            <div className="px-4 py-3 border-b border-border-subtle">
              <AtsSectionHeader
                title="Editor"
                description="Configure nome, etapas e tipo de cada etapa do funil."
              />
            </div>
            <div className="p-4 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pipeline-name">Nome</Label>
                  <Input
                    id="pipeline-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border-subtle bg-surface-sunken px-3 py-2">
                  <div className="min-w-0">
                    <Label
                      htmlFor="pipeline-default"
                      className="text-sm font-medium text-text-primary"
                    >
                      Pipeline padrão
                    </Label>
                    <div className="text-xs text-text-tertiary">
                      Usado por novas vagas automaticamente
                    </div>
                  </div>
                  <Switch
                    id="pipeline-default"
                    checked={isDefault}
                    onCheckedChange={setIsDefault}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">Etapas</span>
                  <MetaPill>{summary.open} em andamento</MetaPill>
                  <MetaPill className="border-status-open/30 bg-status-open/10 text-status-open">
                    {summary.won} ganhas
                  </MetaPill>
                  <MetaPill className="border-status-closed/30 bg-status-closed/10 text-status-closed">
                    {summary.lost} perdidas
                  </MetaPill>
                </div>
                <Button size="sm" variant="outline" onClick={addStage}>
                  <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                  Adicionar etapa
                </Button>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={stages.map((s) => s.value)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-2">
                    {stages.map((s, idx) => (
                      <SortableStageRow
                        key={s.value || idx}
                        stage={s}
                        onChange={(patch) => updateStage(idx, patch)}
                        onRemove={() => removeStage(idx)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border-subtle">
                <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                  <Save className="h-4 w-4 mr-1" aria-hidden="true" />
                  {saveMut.isPending ? "Salvando…" : "Salvar pipeline"}
                </Button>
                {selectedId && (
                  <>
                    <Button variant="outline" onClick={duplicate}>
                      <Copy className="h-4 w-4 mr-1" aria-hidden="true" />
                      Duplicar
                    </Button>
                    {!isDefault && (
                      <Button variant="outline" onClick={() => setDefMut.mutate()}>
                        <Star className="h-4 w-4 mr-1" aria-hidden="true" />
                        Tornar padrão
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={async () => {
                        if (await confirmDialog("Excluir este pipeline?")) deleteMut.mutate();
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" aria-hidden="true" />
                      Excluir
                    </Button>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SortableStageRow({
  stage,
  onChange,
  onRemove,
}: {
  stage: AtsStage;
  onChange: (patch: Partial<AtsStage>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.value,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md border border-border-subtle bg-surface-1 px-2 py-2",
        "hover:border-border-strong transition-colors",
        isDragging && "shadow-sm",
      )}
    >
      <button
        type="button"
        className={cn(
          "touch-none cursor-grab text-text-tertiary hover:text-text-primary p-1 rounded",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        )}
        {...attributes}
        {...listeners}
        aria-label="Reordenar etapa"
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      <div
        className="h-8 w-1.5 rounded-sm shrink-0"
        style={{ background: stage.color ?? "var(--hs-stage-2)" }}
        aria-hidden="true"
      />
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_180px] gap-2 flex-1">
        <Input
          placeholder="Rótulo (exibido)"
          value={stage.label}
          onChange={(e) => onChange({ label: e.target.value })}
          aria-label="Rótulo da etapa"
        />
        <Input
          placeholder="identificador (ex: triagem_rh)"
          value={stage.value}
          onChange={(e) => onChange({ value: e.target.value })}
          className="font-mono text-xs"
          aria-label="Identificador da etapa"
        />
        <Select
          value={stage.type ?? "open"}
          onValueChange={(v) => onChange({ type: v as AtsStage["type"] })}
        >
          <SelectTrigger aria-label="Tipo da etapa">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAGE_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value!}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remover etapa">
        <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
      </Button>
    </div>
  );
}
