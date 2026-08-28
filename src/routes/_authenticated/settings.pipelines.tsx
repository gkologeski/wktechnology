import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Can, usePermissions } from "@/lib/access-control/use-permissions";
import { PIPELINES_MANAGE, PIPELINES_PERMS } from "@/lib/access-control/admin-permission-keys";
import { StageSubstatusesEditor } from "@/components/pipelines/stage-substatuses-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { CARD_FIELD_OPTIONS, DEFAULT_CARD_FIELDS } from "@/components/deals/deals-board-card";
import { confirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/_authenticated/settings/pipelines")({
  component: PipelinesSettings,
});

type Stage = {
  value: string;
  label: string;
  color?: string;
  probability?: number;
  type?: "open" | "won" | "lost";
  sla_hours?: number | null;
};

type PipelineConfig = { card_fields?: string[] };

type Pipeline = {
  id: string;
  name: string;
  entity: string;
  is_default: boolean;
  default_view: string | null;
  stages: Stage[];
  config: PipelineConfig;
};

const ENTITIES = [
  { value: "deal", label: "Negócios" },
  { value: "lead", label: "Leads" },
  { value: "ticket", label: "Tickets" },
];

const VIEWS_BY_ENTITY: Record<string, { value: string; label: string }[]> = {
  deal: [
    { value: "table", label: "Tabela" },
    { value: "board", label: "Quadro" },
    { value: "list", label: "Lista" },
    { value: "forecast", label: "Previsão" },
  ],
  lead: [
    { value: "table", label: "Tabela" },
    { value: "board", label: "Quadro" },
  ],
  ticket: [
    { value: "table", label: "Tabela" },
    { value: "board", label: "Quadro" },
    { value: "split", label: "Split" },
  ],
};

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || `stage_${Date.now()}`
  );
}

function PipelinesSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Pipeline | "new" | null>(null);

  const q = useQuery({
    queryKey: ["settings", "pipelines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("id, name, entity, is_default, default_view, stages, config")
        .order("entity", { ascending: true })
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((p) => ({
        ...p,
        stages: Array.isArray(p.stages) ? (p.stages as unknown as Stage[]) : [],
        config: (p.config && typeof p.config === "object" ? p.config : {}) as PipelineConfig,
      })) as Pipeline[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["settings", "pipelines"] });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Pipelines</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie pipelines e estágios para Leads e Negócios.
          </p>
        </div>
        <Can any={PIPELINES_PERMS.create}>
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        </Can>
      </div>

      <div className="rounded-lg border bg-card divide-y">
        {q.isLoading && <p className="p-4 text-sm text-muted-foreground">Carregando…</p>}
        {!q.isLoading && (q.data?.length ?? 0) === 0 && (
          <p className="p-4 text-sm text-muted-foreground">Nenhum pipeline.</p>
        )}
        {(q.data ?? []).map((p) => (
          <button
            key={p.id}
            className="w-full text-left p-3 hover:bg-accent/30 flex items-center gap-3"
            onClick={() => setEditing(p)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{p.name}</span>
                {p.is_default && (
                  <Badge variant="secondary" className="text-xs">
                    Padrão
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs capitalize">
                  {ENTITIES.find((e) => e.value === p.entity)?.label ?? p.entity}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {p.stages.length} estágio{p.stages.length === 1 ? "" : "s"}:{" "}
                {p.stages.map((s) => s.label).join(" → ") || "—"}
              </p>
            </div>
          </button>
        ))}
      </div>

      {editing && user && (
        <PipelineEditor
          ownerId={user.id}
          pipeline={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function PipelineEditor({
  pipeline,
  ownerId,
  onClose,
  onSaved,
}: {
  pipeline: Pipeline | null;
  ownerId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !pipeline;
  const { canAny } = usePermissions();
  const canManageSubstatus = canAny(PIPELINES_MANAGE);
  const [name, setName] = useState(pipeline?.name ?? "");
  const [entity, setEntity] = useState(pipeline?.entity ?? "deal");
  const [isDefault, setIsDefault] = useState(pipeline?.is_default ?? false);
  const [defaultView, setDefaultView] = useState<string>(pipeline?.default_view ?? "table");
  const [stages, setStages] = useState<Stage[]>(
    pipeline?.stages?.length
      ? pipeline.stages
      : [{ value: "new", label: "Novo", type: "open", probability: 10 }],
  );
  const [cardFields, setCardFields] = useState<string[]>(
    pipeline?.config?.card_fields ?? DEFAULT_CARD_FIELDS,
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Ao trocar de pipeline na lista, rola até o editor (que fica ao fim da página).
  useEffect(() => {
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [pipeline?.id]);

  useEffect(() => {
    setName(pipeline?.name ?? "");
    setEntity(pipeline?.entity ?? "deal");
    setIsDefault(pipeline?.is_default ?? false);
    setDefaultView(pipeline?.default_view ?? "table");
    setStages(
      pipeline?.stages?.length
        ? pipeline.stages
        : [{ value: "new", label: "Novo", type: "open", probability: 10 }],
    );
    setCardFields(pipeline?.config?.card_fields ?? DEFAULT_CARD_FIELDS);
  }, [pipeline]);

  const valuesSet = useMemo(() => new Set(stages.map((s) => s.value)), [stages]);

  const updateStage = (i: number, patch: Partial<Stage>) => {
    setStages((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };
  const addStage = () => {
    let v = `stage_${stages.length + 1}`;
    while (valuesSet.has(v)) v += "_";
    setStages((p) => [...p, { value: v, label: "Novo estágio", type: "open", probability: 50 }]);
  };
  const removeStage = (i: number) => setStages((p) => p.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    setStages((p) => {
      const j = i + dir;
      if (j < 0 || j >= p.length) return p;
      const out = [...p];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });
  };

  const save = async () => {
    if (saving) return;
    if (!name.trim()) return toast.error("Nome obrigatório");
    if (stages.length === 0) return toast.error("Adicione ao menos um estágio");
    // ensure unique values
    const seen = new Set<string>();
    for (const s of stages) {
      if (!s.label.trim()) return toast.error("Estágio sem nome");
      const v = (s.value || slugify(s.label)).trim();
      if (seen.has(v)) return toast.error(`Identificador duplicado: ${v}`);
      seen.add(v);
    }
    const payloadStages = stages.map((s) => ({
      value: (s.value || slugify(s.label)).trim(),
      label: s.label.trim(),
      color: s.color || undefined,
      probability: typeof s.probability === "number" ? s.probability : undefined,
      type: s.type ?? "open",
      sla_hours: s.sla_hours ?? null,
    }));

    const payloadConfig = {
      ...(pipeline?.config ?? {}),
      card_fields: cardFields,
    };

    setSaving(true);
    try {
      if (isNew) {
        const { error } = await supabase.from("pipelines").insert({
          owner_id: ownerId,
          name: name.trim(),
          entity,
          is_default: isDefault,
          default_view: defaultView,
          stages: payloadStages as unknown as never,
          config: payloadConfig as unknown as never,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pipelines")
          .update({
            name: name.trim(),
            entity,
            is_default: isDefault,
            default_view: defaultView,
            stages: payloadStages as unknown as never,
            config: payloadConfig as unknown as never,
          })
          .eq("id", pipeline!.id);
        if (error) throw error;
      }
      toast.success("Salvo");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pipeline || deleting) return;
    if (!(await confirmDialog(`Excluir pipeline "${pipeline.name}"?`))) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("pipelines").delete().eq("id", pipeline.id);
      if (error) throw error;
      toast.success("Excluído");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card ref={rootRef} className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="text-base">{isNew ? "Novo pipeline" : "Editar pipeline"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Nome *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Pipeline padrão"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Entidade</Label>
            <Select value={entity} onValueChange={setEntity}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITIES.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={isDefault} onCheckedChange={setIsDefault} id="is-default" />
            <Label htmlFor="is-default" className="text-sm cursor-pointer">
              Pipeline padrão
            </Label>
          </div>
          <div className="space-y-1 min-w-[200px]">
            <Label className="text-xs">Visualização padrão</Label>
            <Select value={defaultView} onValueChange={setDefaultView}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(VIEWS_BY_ENTITY[entity] ?? VIEWS_BY_ENTITY.deal).map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Estágios</Label>
            <Button size="sm" variant="outline" onClick={addStage}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar estágio
            </Button>
          </div>
          <div className="rounded-md border divide-y">
            {stages.map((s, i) => (
              <div key={i} className="p-3 space-y-3">
                {/* Linha 1: identidade da etapa + ações */}
                <div className="grid gap-2 sm:grid-cols-12 items-end">
                  <div className="sm:col-span-6 space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Nome</Label>
                    <Input
                      value={s.label}
                      onChange={(e) => {
                        const label = e.target.value;
                        // auto-sync value while creating new stage if value matches slug of previous label
                        const prevSlug = slugify(s.label);
                        updateStage(i, {
                          label,
                          value: s.value === prevSlug || !s.value ? slugify(label) : s.value,
                        });
                      }}
                    />
                  </div>
                  <div className="sm:col-span-3 space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Tipo</Label>
                    <Select
                      value={s.type ?? "open"}
                      onValueChange={(v) => updateStage(i, { type: v as Stage["type"] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Aberto</SelectItem>
                        <SelectItem value="won">Ganho</SelectItem>
                        <SelectItem value="lost">Perdido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-3 flex gap-1 justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Mover etapa para cima"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Mover etapa para baixo"
                      onClick={() => move(i, 1)}
                      disabled={i === stages.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Remover etapa"
                      onClick={() => removeStage(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {/* Linha 2: metadados numéricos e cor, com larguras mínimas reais */}
                <div className="grid gap-2 sm:grid-cols-12 items-end">
                  <div className="sm:col-span-4 space-y-1 min-w-0">
                    <Label className="text-[10px] text-muted-foreground">Identificador</Label>
                    <Input
                      value={s.value}
                      onChange={(e) => updateStage(i, { value: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Prob. %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={s.probability ?? ""}
                      onChange={(e) =>
                        updateStage(i, {
                          probability: e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-[10px] text-muted-foreground">SLA (h)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={s.sla_hours ?? ""}
                      onChange={(e) =>
                        updateStage(i, {
                          sla_hours: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="sm:col-span-4 space-y-1 min-w-0">
                    <Label className="text-[10px] text-muted-foreground">Cor</Label>
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-9 w-9 shrink-0 rounded-md border"
                        style={{ background: s.color || "transparent" }}
                      />
                      <Input
                        value={s.color ?? ""}
                        placeholder="var(--…) ou #hex"
                        className="min-w-0"
                        onChange={(e) => updateStage(i, { color: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                {pipeline?.id && s.value ? (
                  <StageSubstatusesEditor
                    pipelineId={pipeline.id}
                    stageValue={s.value}
                    stageLabel={s.label || s.value}
                    stageType={s.type ?? "open"}
                    canManage={canManageSubstatus}
                  />
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Salve o pipeline para configurar os substatus desta etapa.
                  </p>
                )}
              </div>
            ))}
            {stages.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">Nenhum estágio.</p>
            )}
          </div>
        </div>

        {entity === "deal" && (
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Campos exibidos no card do quadro</Label>
              <p className="text-[11px] text-muted-foreground">
                O nome do negócio é sempre mostrado. Marque/desmarque os demais campos.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 rounded-md border p-3">
              {CARD_FIELD_OPTIONS.map((opt) => {
                const checked = cardFields.includes(opt.key);
                return (
                  <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        setCardFields((prev) =>
                          v
                            ? [...prev.filter((k) => k !== opt.key), opt.key]
                            : prev.filter((k) => k !== opt.key),
                        );
                      }}
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          <div>
            {!isNew && (
              <Can any={PIPELINES_PERMS.delete}>
                <Button variant="outline" size="sm" onClick={remove} disabled={deleting}>
                  <Trash2 className="h-4 w-4 mr-1" /> {deleting ? "Excluindo…" : "Excluir"}
                </Button>
              </Can>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Can any={PIPELINES_MANAGE}>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </Can>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
