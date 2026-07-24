/**
 * Editor de questionários de qualificação (BANT/MEDDIC/CHAMP/GPCT/custom).
 * Aba "Questionários" da Suíte de Prospecção.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, GripVertical, Copy, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AtsSectionHeader, EmptyState } from "@/components/ats/ui";
import {
  listQuestionnaires,
  getQuestionnaire,
  upsertQuestionnaire,
  deleteQuestionnaire,
  upsertQuestion,
  deleteQuestion,
  duplicateQuestionnaire,
} from "@/lib/prospecting/questionnaires.functions";

type Framework = "bant" | "meddic" | "champ" | "gpct" | "custom";
type QuestionType = "single" | "multi" | "number" | "text" | "boolean";

const FRAMEWORK_LABELS: Record<Framework, string> = {
  bant: "BANT",
  meddic: "MEDDIC",
  champ: "CHAMP",
  gpct: "GPCT",
  custom: "Customizado",
};

const TYPE_LABELS: Record<QuestionType, string> = {
  single: "Escolha única",
  multi: "Múltipla escolha",
  number: "Número",
  text: "Texto livre",
  boolean: "Sim / Não",
};

export function QuestionnairesTab() {
  const list = useServerFn(listQuestionnaires);
  const del = useServerFn(deleteQuestionnaire);
  const duplicate = useServerFn(duplicateQuestionnaire);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["prospecting", "questionnaires"],
    queryFn: () => list(),
  });

  const [openNew, setOpenNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const duplicateMut = useMutation({
    mutationFn: (id: string) => duplicate({ data: { id } }),
    onSuccess: (res) => {
      toast.success("Questionário duplicado. Edite a cópia.");
      qc.invalidateQueries({ queryKey: ["prospecting", "questionnaires"] });
      setEditingId(res.id);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Questionário removido.");
      qc.invalidateQueries({ queryKey: ["prospecting", "questionnaires"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const items = data ?? [];
  const templates = items.filter((q) => q.is_template);
  const mine = items.filter((q) => !q.is_template);

  return (
    <div className="space-y-8">
      <AtsSectionHeader
        title="Modelos"
        description="Frameworks prontos (BANT, MEDDIC, CHAMP, GPCT). São somente leitura — duplique para personalizar."
      />
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : templates.length === 0 ? (
        <EmptyState title="Nenhum modelo disponível" description="Peça ao administrador para carregar os modelos padrão." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((q) => (
            <Card key={q.id} className="hover:shadow-sm transition-shadow border-dashed">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm">{q.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      Modelo
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {FRAMEWORK_LABELS[q.framework as Framework] ?? q.framework}
                    </Badge>
                  </div>
                </div>
                {q.description ? (
                  <p className="text-xs text-muted-foreground line-clamp-2">{q.description}</p>
                ) : null}
              </CardHeader>
              <CardContent className="pt-0 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Corte: <span className="font-medium text-foreground">{q.pass_threshold}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setViewingId(q.id)}
                    aria-label="Visualizar"
                  >
                    <Eye className="w-4 h-4 mr-1" /> Visualizar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={duplicateMut.isPending}
                    onClick={() => duplicateMut.mutate(q.id)}
                    aria-label="Duplicar"
                  >
                    <Copy className="w-4 h-4 mr-1" /> Duplicar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AtsSectionHeader
        title="Meus questionários"
        description="Questionários editáveis do seu workspace. Duplique um modelo ou crie do zero."
        action={
          <Button size="sm" onClick={() => setOpenNew(true)}>
            <Plus className="w-4 h-4 mr-1" /> Novo
          </Button>
        }
      />
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : mine.length === 0 ? (
        <EmptyState
          title="Nenhum questionário ainda"
          description="Duplique um modelo acima ou crie um questionário do zero."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {mine.map((q) => (
            <Card key={q.id} className="hover:shadow-sm transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm">{q.name}</CardTitle>
                  <Badge variant="outline" className="text-[10px]">
                    {FRAMEWORK_LABELS[q.framework as Framework] ?? q.framework}
                  </Badge>
                </div>
                {q.description ? (
                  <p className="text-xs text-muted-foreground line-clamp-2">{q.description}</p>
                ) : null}
              </CardHeader>
              <CardContent className="pt-0 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Corte: <span className="font-medium text-foreground">{q.pass_threshold}</span>
                  {q.enabled ? null : (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      Inativo
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditingId(q.id)}
                    aria-label="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => duplicateMut.mutate(q.id)}
                    disabled={duplicateMut.isPending}
                    aria-label="Duplicar"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Excluir "${q.name}"?`)) delMut.mutate(q.id);
                    }}
                    aria-label="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <QuestionnaireDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onSaved={() => {
          setOpenNew(false);
          qc.invalidateQueries({ queryKey: ["prospecting", "questionnaires"] });
        }}
      />

      {editingId ? (
        <QuestionnaireEditorSheet
          id={editingId}
          onClose={() => setEditingId(null)}
          onChanged={() =>
            qc.invalidateQueries({ queryKey: ["prospecting", "questionnaires"] })
          }
        />
      ) : null}

      {viewingId ? (
        <QuestionnaireEditorSheet
          id={viewingId}
          readOnly
          onClose={() => setViewingId(null)}
          onChanged={() => {}}
        />
      ) : null}
    </div>
  );
}

function QuestionnaireDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const upsert = useServerFn(upsertQuestionnaire);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [framework, setFramework] = useState<Framework>("custom");
  const [threshold, setThreshold] = useState(0);

  const save = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          name,
          description: description || null,
          framework,
          pass_threshold: threshold,
          enabled: true,
        },
      }),
    onSuccess: () => {
      toast.success("Questionário criado.");
      setName("");
      setDescription("");
      setFramework("custom");
      setThreshold(0);
      onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo questionário</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Framework base</Label>
              <Select value={framework} onValueChange={(v) => setFramework(v as Framework)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FRAMEWORK_LABELS) as Framework[]).map((f) => (
                    <SelectItem key={f} value={f}>
                      {FRAMEWORK_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nota de corte (score mínimo)</Label>
              <Input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!name || save.isPending} onClick={() => save.mutate()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuestionnaireEditorSheet({
  id,
  onClose,
  onChanged,
  readOnly = false,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
  readOnly?: boolean;
}) {
  const get = useServerFn(getQuestionnaire);
  const upsertMeta = useServerFn(upsertQuestionnaire);
  const upsertQ = useServerFn(upsertQuestion);
  const delQ = useServerFn(deleteQuestion);
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["prospecting", "questionnaire", id],
    queryFn: () => get({ data: { id } }),
  });

  const [addingLabel, setAddingLabel] = useState("");
  const [addingType, setAddingType] = useState<QuestionType>("single");

  const invalidate = () => {
    refetch();
    onChanged();
    qc.invalidateQueries({ queryKey: ["prospecting", "questionnaires"] });
  };

  const addQ = useMutation({
    mutationFn: async () => {
      const position = (data?.questions ?? []).length;
      const defaults =
        addingType === "single" || addingType === "multi"
          ? [
              { label: "Sim", points: 10 },
              { label: "Não", points: 0 },
            ]
          : [];
      return upsertQ({
        data: {
          questionnaire_id: id,
          position,
          label: addingLabel,
          type: addingType,
          options: defaults,
          weight: 1,
          required: false,
        },
      });
    },
    onSuccess: () => {
      setAddingLabel("");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleEnabled = useMutation({
    mutationFn: (enabled: boolean) =>
      upsertMeta({
        data: {
          id,
          name: data!.questionnaire.name,
          framework: data!.questionnaire.framework as Framework,
          enabled,
          pass_threshold: data!.questionnaire.pass_threshold,
        },
      }),
    onSuccess: invalidate,
  });

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {data?.questionnaire.name ?? "Carregando..."}
            {readOnly ? (
              <Badge variant="secondary" className="text-[10px]">Modelo</Badge>
            ) : null}
          </SheetTitle>
        </SheetHeader>
        {isLoading || !data ? (
          <div className="text-sm text-muted-foreground mt-4">Carregando...</div>
        ) : (
          <div className="space-y-6 mt-4">
            {readOnly ? null : (
              <div className="flex items-center justify-between rounded-md border p-3 bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Ativo</p>
                  <p className="text-xs text-muted-foreground">
                    Questionários ativos aparecem no painel de qualificação.
                  </p>
                </div>
                <Switch
                  checked={data.questionnaire.enabled}
                  onCheckedChange={(v) => toggleEnabled.mutate(v)}
                />
              </div>
            )}

            <div>
              <AtsSectionHeader title="Perguntas" description="Cada resposta pontuada soma no score final." />
              <div className="space-y-2 mt-3">
                {data.questions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma pergunta ainda.</p>
                ) : (
                  data.questions.map((q) => (
                    <QuestionRow
                      key={q.id}
                      question={q}
                      onDeleted={invalidate}
                      onSaved={invalidate}
                      readOnly={readOnly}
                    />
                  ))
                )}
              </div>
            </div>

            {readOnly ? null : (
              <div className="rounded-md border p-3 space-y-3">
                <p className="text-sm font-medium">Adicionar pergunta</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Enunciado</Label>
                    <Input
                      value={addingLabel}
                      onChange={(e) => setAddingLabel(e.target.value)}
                      placeholder="Qual o orçamento aprovado?"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={addingType} onValueChange={(v) => setAddingType(v as QuestionType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => (
                          <SelectItem key={t} value={t}>
                            {TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={!addingLabel || addQ.isPending}
                  onClick={() => addQ.mutate()}
                >
                  <Plus className="w-4 h-4 mr-1" /> Adicionar
                </Button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function QuestionRow({
  question,
  onDeleted,
  onSaved,
  readOnly = false,
}: {
  question: {
    id: string;
    questionnaire_id: string;
    position: number;
    label: string;
    type: string;
    options: unknown;
    weight: number;
    required: boolean;
  };
  onDeleted: () => void;
  onSaved: () => void;
  readOnly?: boolean;
}) {
  const upsertQ = useServerFn(upsertQuestion);
  const delQ = useServerFn(deleteQuestion);
  const [expanded, setExpanded] = useState(false);
  const [label, setLabel] = useState(question.label);
  const [weight, setWeight] = useState(question.weight);
  const [required, setRequired] = useState(question.required);
  const [options, setOptions] = useState<{ label: string; points: number }[]>(
    Array.isArray(question.options)
      ? (question.options as { label: string; points: number }[])
      : [],
  );

  const supportsOptions = question.type === "single" || question.type === "multi";

  const save = useMutation({
    mutationFn: () =>
      upsertQ({
        data: {
          id: question.id,
          questionnaire_id: question.questionnaire_id,
          position: question.position,
          label,
          type: question.type as QuestionType,
          options: supportsOptions ? options : [],
          weight,
          required,
        },
      }),
    onSuccess: () => {
      toast.success("Pergunta salva.");
      setExpanded(false);
      onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: () => delQ({ data: { id: question.id } }),
    onSuccess: () => {
      toast.success("Pergunta removida.");
      onDeleted();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="rounded-md border p-3 bg-background">
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{question.label}</span>
            <Badge variant="outline" className="text-[10px] shrink-0">
              {TYPE_LABELS[question.type as QuestionType] ?? question.type}
            </Badge>
            {question.required ? (
              <Badge variant="secondary" className="text-[10px] shrink-0">
                obrigatória
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Peso: {question.weight}</p>
        </div>
        {readOnly ? null : (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setExpanded((v) => !v)}
              aria-label="Editar"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                if (confirm("Excluir esta pergunta?")) del.mutate();
              }}
              aria-label="Excluir"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {expanded ? (
        <div className="mt-3 space-y-3 pl-6">
          <div className="space-y-1">
            <Label className="text-xs">Enunciado</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Peso</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={weight}
                onChange={(e) => setWeight(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3">
              <Label className="text-xs">Obrigatória</Label>
              <Switch checked={required} onCheckedChange={setRequired} />
            </div>
          </div>

          {supportsOptions ? (
            <div className="space-y-2">
              <Label className="text-xs">Opções (rótulo + pontos)</Label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={opt.label}
                    onChange={(e) => {
                      const next = [...options];
                      next[i] = { ...next[i], label: e.target.value };
                      setOptions(next);
                    }}
                    placeholder="Rótulo"
                  />
                  <Input
                    className="w-24"
                    type="number"
                    value={opt.points}
                    onChange={(e) => {
                      const next = [...options];
                      next[i] = { ...next[i], points: Number(e.target.value) || 0 };
                      setOptions(next);
                    }}
                    placeholder="pts"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                    aria-label="Remover opção"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOptions([...options, { label: "", points: 0 }])}
              >
                <Plus className="w-3 h-3 mr-1" /> Nova opção
              </Button>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setExpanded(false)}>
              Cancelar
            </Button>
            <Button size="sm" disabled={!label || save.isPending} onClick={() => save.mutate()}>
              Salvar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
