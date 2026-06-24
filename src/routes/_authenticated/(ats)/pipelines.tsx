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
import {
  GitBranch,
  Plus,
  Trash2,
  GripVertical,
  Star,
  StarOff,
  Save,
  Copy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  savePipeline,
  deletePipeline,
  setDefaultPipeline,
} from "@/lib/ats/pipelines.functions";
import { DEFAULT_ATS_STAGES, type AtsStage } from "@/lib/ats/stages";

export const Route = createFileRoute("/_authenticated/(ats)/pipelines")({
  component: PipelinesPage,
});

type Pipeline = {
  id: string;
  name: string;
  is_default: boolean;
  stages: AtsStage[];
};

const STAGE_TYPES: { value: AtsStage["type"]; label: string; color: string }[] = [
  { value: "open", label: "Em andamento", color: "var(--hs-stage-2)" },
  { value: "won", label: "Ganho (contratado)", color: "var(--hs-stage-won)" },
  { value: "lost", label: "Perdido (rejeitado)", color: "var(--hs-stage-lost)" },
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

function PipelinesPage() {
  const list = useServerFn(listAtsPipelines);
  const save = useServerFn(savePipeline);
  const del = useServerFn(deletePipeline);
  const setDef = useServerFn(setDefaultPipeline);
  const qc = useQueryClient();

  const { data: pipelines = [], isLoading } = useQuery({
    queryKey: ["ats-pipelines"],
    queryFn: () => list() as unknown as Promise<Pipeline[]>,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [stages, setStages] = useState<AtsStage[]>([]);

  // Seleciona o primeiro ao carregar / quando muda lista
  useEffect(() => {
    if (!pipelines.length) return;
    if (!selectedId || !pipelines.find((p) => p.id === selectedId)) {
      setSelectedId(pipelines[0].id);
    }
  }, [pipelines, selectedId]);

  // Sincroniza form ao mudar seleção
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
    setStages([...stages, { value: base, label: "Nova etapa", color: "var(--hs-stage-2)", type: "open" }]);
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
      // valida values únicos / slugs
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

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Pipelines de recrutamento
          </h1>
          <p className="text-sm text-muted-foreground">
            Crie, reordene e personalize as etapas de cada funil. Arraste para reordenar.
          </p>
        </div>
        <Button variant="outline" onClick={newPipeline}>
          <Plus className="h-4 w-4 mr-1" /> Novo pipeline
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
        {/* lista */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pipelines</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 p-2">
            {pipelines.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`text-left px-3 py-2 rounded-md text-sm hover:bg-muted/60 transition ${
                  selectedId === p.id ? "bg-muted" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate">{p.name}</span>
                  {p.is_default && (
                    <Badge variant="secondary" className="gap-1">
                      <Star className="h-3 w-3" /> padrão
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {p.stages?.length ?? 0} etapas
                </div>
              </button>
            ))}
            {pipelines.length === 0 && (
              <div className="text-xs text-muted-foreground p-3">Nenhum pipeline.</div>
            )}
          </CardContent>
        </Card>

        {/* editor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Editor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Pipeline padrão</div>
                  <div className="text-xs text-muted-foreground">
                    Usado por novas vagas automaticamente
                  </div>
                </div>
                <Switch checked={isDefault} onCheckedChange={setIsDefault} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Etapas</div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{summary.open} abertas</Badge>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                  {summary.won} ganhas
                </Badge>
                <Badge variant="outline" className="border-rose-500/40 text-rose-700 dark:text-rose-300">
                  {summary.lost} perdidas
                </Badge>
                <Button size="sm" variant="outline" onClick={addStage}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar etapa
                </Button>
              </div>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={stages.map((s) => s.value)} strategy={verticalListSortingStrategy}>
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

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                <Save className="h-4 w-4 mr-1" />
                {saveMut.isPending ? "Salvando…" : "Salvar pipeline"}
              </Button>
              {selectedId && (
                <>
                  <Button variant="outline" onClick={duplicate}>
                    <Copy className="h-4 w-4 mr-1" /> Duplicar
                  </Button>
                  {!isDefault && (
                    <Button variant="outline" onClick={() => setDefMut.mutate()}>
                      <Star className="h-4 w-4 mr-1" /> Tornar padrão
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm("Excluir este pipeline?")) deleteMut.mutate();
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Excluir
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
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
      className="flex items-center gap-2 rounded-md border bg-card px-2 py-2"
    >
      <button
        type="button"
        className="touch-none cursor-grab text-muted-foreground hover:text-foreground p-1"
        {...attributes}
        {...listeners}
        aria-label="Reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div
        className="h-8 w-1.5 rounded-sm shrink-0"
        style={{ background: stage.color ?? "var(--hs-stage-2)" }}
      />
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_180px] gap-2 flex-1">
        <Input
          placeholder="Rótulo (exibido)"
          value={stage.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />
        <Input
          placeholder="identificador (ex: triagem_rh)"
          value={stage.value}
          onChange={(e) => onChange({ value: e.target.value })}
          className="font-mono text-xs"
        />
        <Select
          value={stage.type ?? "open"}
          onValueChange={(v) => onChange({ type: v as AtsStage["type"] })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
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
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
