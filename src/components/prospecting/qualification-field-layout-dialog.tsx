/**
 * Configurador dos blocos de campos de entidades exibidos na qualificação.
 * Permite escolher entidade, posição (antes/depois das perguntas) e quais
 * campos aparecem — configuração salva por questionário.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getEntityFieldCatalog } from "@/lib/entity-fields.functions";
import { saveQuestionnaireFieldLayout } from "@/lib/prospecting/questionnaires.functions";
import {
  QUALIFICATION_FIELD_ENTITIES,
  entityLabel,
  type QualificationFieldBlock,
  type QualificationFieldEntity,
  type QualificationFieldType,
} from "@/lib/prospecting/field-layout";

function newId() {
  return `blk-${Math.random().toString(36).slice(2, 10)}`;
}

export function QualificationFieldLayoutDialog({
  open,
  onOpenChange,
  questionnaireId,
  blocks,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  questionnaireId: string;
  blocks: QualificationFieldBlock[];
  onSaved?: () => void;
}) {
  const saveLayout = useServerFn(saveQuestionnaireFieldLayout);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<QualificationFieldBlock[]>(blocks);
  const [activeId, setActiveId] = useState<string | null>(blocks[0]?.id ?? null);

  // Reinicia o rascunho a cada abertura para refletir o layout salvo.
  const [openedFor, setOpenedFor] = useState<boolean>(open);
  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) {
      setDraft(blocks);
      setActiveId(blocks[0]?.id ?? null);
    }
  }

  const active = draft.find((b) => b.id === activeId) ?? null;

  const save = useMutation({
    mutationFn: () =>
      saveLayout({ data: { id: questionnaireId, field_layout: draft.map(sanitize) } }),
    onSuccess: () => {
      toast.success("Configuração de campos salva.");
      qc.invalidateQueries({ queryKey: ["prospecting", "questionnaire", questionnaireId] });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const addBlock = () => {
    const block: QualificationFieldBlock = {
      id: newId(),
      entity: "leads",
      position: "before",
      title: "Dados do Lead",
      fields: [],
    };
    setDraft((d) => [...d, block]);
    setActiveId(block.id);
  };

  const updateActive = (patch: Partial<QualificationFieldBlock>) => {
    if (!active) return;
    setDraft((d) => d.map((b) => (b.id === active.id ? { ...b, ...patch } : b)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Configurar campos exibidos</DialogTitle>
          <DialogDescription>
            Escolha quais campos de Lead, Empresa e Contato aparecem antes ou depois das perguntas
            deste questionário. Os campos são editáveis durante a qualificação.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Blocos</Label>
              <Button size="sm" variant="ghost" onClick={addBlock}>
                <Plus className="h-4 w-4 mr-1" /> Novo
              </Button>
            </div>
            {draft.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum bloco configurado. Crie um bloco para exibir campos.
              </p>
            ) : (
              <ul className="space-y-1">
                {draft.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(b.id)}
                      className={`w-full text-left rounded-md px-2 py-1.5 text-sm transition-colors ${
                        b.id === activeId
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <span className="block truncate">{b.title}</span>
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                        {entityLabel(b.entity)} ·{" "}
                        {b.position === "before" ? "antes" : "depois"} · {b.fields.length} campo(s)
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="min-w-0">
            {!active ? (
              <p className="text-sm text-muted-foreground">
                Selecione ou crie um bloco para configurar os campos.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Entidade</Label>
                    <Select
                      value={active.entity}
                      onValueChange={(v) =>
                        updateActive({ entity: v as QualificationFieldEntity, fields: [] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUALIFICATION_FIELD_ENTITIES.map((e) => (
                          <SelectItem key={e.value} value={e.value}>
                            {e.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Posição</Label>
                    <Select
                      value={active.position}
                      onValueChange={(v) =>
                        updateActive({ position: v as QualificationFieldBlock["position"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="before">Antes das perguntas</SelectItem>
                        <SelectItem value="after">Depois das perguntas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs" htmlFor="block-title">
                      Título do bloco
                    </Label>
                    <Input
                      id="block-title"
                      value={active.title}
                      onChange={(e) => updateActive({ title: e.target.value })}
                    />
                  </div>
                </div>

                <FieldPicker
                  entity={active.entity}
                  block={active}
                  onChange={(fields) => updateActive({ fields })}
                />

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    setDraft((d) => d.filter((b) => b.id !== active.id));
                    setActiveId(null);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Remover bloco
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar configuração"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function sanitize(b: QualificationFieldBlock): QualificationFieldBlock {
  return {
    id: b.id,
    entity: b.entity,
    position: b.position,
    title: b.title.trim() || entityLabel(b.entity),
    fields: b.fields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required === true,
      ...(f.options?.length ? { options: f.options.slice(0, 200) } : {}),
    })),
  };
}

function FieldPicker({
  entity,
  block,
  onChange,
}: {
  entity: QualificationFieldEntity;
  block: QualificationFieldBlock;
  onChange: (fields: QualificationFieldBlock["fields"]) => void;
}) {
  const catalog = useServerFn(getEntityFieldCatalog);
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["entity-field-catalog", entity],
    queryFn: () => catalog({ data: { entity } }),
  });

  const fields = useMemo(() => {
    const all = (data?.fields ?? []).filter((f) => !f.system);
    const q = search.trim().toLowerCase();
    return q ? all.filter((f) => f.label.toLowerCase().includes(q)) : all;
  }, [data, search]);

  const selectedByKey = useMemo(
    () => new Map(block.fields.map((f) => [f.key, f])),
    [block.fields],
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Não foi possível carregar os campos. Feche e abra novamente a configuração.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">Campos exibidos</Label>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar campo..."
        aria-label="Buscar campo"
      />
      <div className="max-h-64 overflow-y-auto rounded-md border border-border/60 divide-y divide-border/40">
        {fields.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">Nenhum campo encontrado.</p>
        ) : (
          fields.map((f) => {
            const selected = selectedByKey.get(f.name);
            return (
              <div key={f.name} className="flex items-center gap-3 px-3 py-2">
                <Checkbox
                  id={`fp-${entity}-${f.name}`}
                  checked={!!selected}
                  onCheckedChange={(v) => {
                    if (v) {
                      onChange([
                        ...block.fields,
                        {
                          key: f.name,
                          label: f.label,
                          type: (f.ref ? "text" : f.type) as QualificationFieldType,
                          required: false,
                          ...(f.options?.length && !f.ref ? { options: f.options } : {}),
                        },
                      ]);
                    } else {
                      onChange(block.fields.filter((x) => x.key !== f.name));
                    }
                  }}
                />
                <Label htmlFor={`fp-${entity}-${f.name}`} className="flex-1 text-sm font-normal">
                  {f.label}
                </Label>
                {selected ? (
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox
                      checked={selected.required === true}
                      onCheckedChange={(v) =>
                        onChange(
                          block.fields.map((x) =>
                            x.key === f.name ? { ...x, required: v === true } : x,
                          ),
                        )
                      }
                    />
                    obrigatório
                  </label>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
