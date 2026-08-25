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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AtsSectionHeader, EmptyState } from "@/components/ats/ui";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  listQuestionnaires,
  getQuestionnaire,
  upsertQuestionnaire,
  deleteQuestionnaire,
  upsertQuestion,
  deleteQuestion,
  duplicateQuestionnaire,
  reorderQuestions,
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
        <EmptyState
          title="Nenhum modelo disponível"
          description="Peça ao administrador para carregar os modelos padrão."
        />
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
              <CardContent className="pt-0 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground min-w-0">
                  Corte: <span className="font-medium text-foreground">{q.pass_threshold}</span>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setViewingId(q.id)}
                    aria-label="Visualizar"
                    title="Visualizar"
                  >
                    <Eye className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Visualizar</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={duplicateMut.isPending}
                    onClick={() => duplicateMut.mutate(q.id)}
                    aria-label="Duplicar"
                    title="Duplicar"
                  >
                    <Copy className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Duplicar</span>
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
              <CardContent className="pt-0 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground min-w-0">
                  Corte: <span className="font-medium text-foreground">{q.pass_threshold}</span>
                  {q.enabled ? null : (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      Inativo
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditingId(q.id)}
                    aria-label="Editar"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => duplicateMut.mutate(q.id)}
                    disabled={duplicateMut.isPending}
                    aria-label="Duplicar"
                    title="Duplicar"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      if (await confirmDialog(`Excluir "${q.name}"?`)) delMut.mutate(q.id);
                    }}
                    aria-label="Excluir"
                    title="Excluir"
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
          onChanged={() => qc.invalidateQueries({ queryKey: ["prospecting", "questionnaires"] })}
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
  const [name, setName] = useState("");

  useEffect(() => {
    if (data?.questionnaire.name) setName(data.questionnaire.name);
  }, [data?.questionnaire.name]);

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

  const saveName = useMutation({
    mutationFn: (nextName: string) =>
      upsertMeta({
        data: {
          id,
          name: nextName,
          framework: data!.questionnaire.framework as Framework,
          enabled: data!.questionnaire.enabled,
          pass_threshold: data!.questionnaire.pass_threshold,
        },
      }),
    onSuccess: () => {
      toast.success("Nome atualizado.");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleEnabled = useMutation({
    mutationFn: (enabled: boolean) =>
      upsertMeta({
        data: {
          id,
          name,
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
              <Badge variant="secondary" className="text-[10px]">
                Modelo
              </Badge>
            ) : null}
          </SheetTitle>
        </SheetHeader>
        {isLoading || !data ? (
          <div className="text-sm text-muted-foreground mt-4">Carregando...</div>
        ) : (
          <div className="space-y-6 mt-4">
            {readOnly ? null : (
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => {
                    if (name && name !== data.questionnaire.name) saveName.mutate(name);
                  }}
                  disabled={saveName.isPending}
                />
              </div>
            )}
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
              <AtsSectionHeader
                title="Perguntas"
                description="Cada resposta pontuada soma no score final."
              />
              <QuestionsList
                questionnaireId={id}
                questions={data.questions}
                readOnly={readOnly}
                onChanged={invalidate}
              />
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
                    <Select
                      value={addingType}
                      onValueChange={(v) => setAddingType(v as QuestionType)}
                    >
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

type QuestionRecord = {
  id: string;
  questionnaire_id: string;
  position: number;
  label: string;
  type: string;
  options: unknown;
  weight: number;
  required: boolean;
};

function QuestionsList({
  questionnaireId,
  questions,
  readOnly,
  onChanged,
}: {
  questionnaireId: string;
  questions: QuestionRecord[];
  readOnly: boolean;
  onChanged: () => void;
}) {
  const reorder = useServerFn(reorderQuestions);
  const [order, setOrder] = useState<QuestionRecord[]>(questions);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  useEffect(() => {
    setOrder(questions);
  }, [questions]);

  const reorderMut = useMutation({
    mutationFn: (ids: string[]) =>
      reorder({ data: { questionnaire_id: questionnaireId, ordered_ids: ids } }),
    onSuccess: () => onChanged(),
    onError: (e) => {
      toast.error((e as Error).message);
      setOrder(questions);
    },
  });

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const fromIdx = order.findIndex((q) => q.id === dragId);
    const toIdx = order.findIndex((q) => q.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = order.slice();
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setOrder(next);
    setDragId(null);
    setOverId(null);
    reorderMut.mutate(next.map((q) => q.id));
  };

  if (order.length === 0) {
    return <p className="text-sm text-muted-foreground mt-3">Nenhuma pergunta ainda.</p>;
  }

  return (
    <div className="space-y-2 mt-3">
      {order.map((q) => (
        <div
          key={q.id}
          draggable={!readOnly}
          onDragStart={(e) => {
            if (readOnly) return;
            setDragId(q.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            if (readOnly || !dragId) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (overId !== q.id) setOverId(q.id);
          }}
          onDragLeave={() => {
            if (overId === q.id) setOverId(null);
          }}
          onDrop={(e) => {
            if (readOnly) return;
            e.preventDefault();
            onDrop(q.id);
          }}
          onDragEnd={() => {
            setDragId(null);
            setOverId(null);
          }}
          className={
            (dragId === q.id ? "opacity-50 " : "") +
            (overId === q.id && dragId && dragId !== q.id
              ? "ring-2 ring-primary/50 rounded-md "
              : "") +
            (readOnly ? "" : "cursor-grab active:cursor-grabbing")
          }
        >
          <QuestionRow question={q} onDeleted={onChanged} onSaved={onChanged} readOnly={readOnly} />
        </div>
      ))}
    </div>
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
    text_points?: number | null;
    text_min_chars?: number | null;
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
  const [textPoints, setTextPoints] = useState(Number(question.text_points ?? 0));
  const [textMinChars, setTextMinChars] = useState(Number(question.text_min_chars ?? 10));
  const [options, setOptions] = useState<{ label: string; points: number }[]>(
    Array.isArray(question.options)
      ? (question.options as { label: string; points: number }[])
      : [],
  );

  const supportsOptions = question.type === "single" || question.type === "multi";
  // Perguntas abertas (texto/número) podem pontuar por preenchimento.
  const supportsTextPoints = question.type === "text" || question.type === "number";

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
          text_points: supportsTextPoints ? textPoints : 0,
          text_min_chars: textMinChars,
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
              onClick={async () => {
                if (await confirmDialog("Excluir esta pergunta?")) del.mutate();
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

          {supportsTextPoints ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs" htmlFor={`tp-${question.id}`}>
                  Pontos ao responder
                </Label>
                <Input
                  id={`tp-${question.id}`}
                  type="number"
                  min={0}
                  max={1000}
                  value={textPoints}
                  onChange={(e) => setTextPoints(Math.max(0, Number(e.target.value) || 0))}
                />
                <p className="text-[11px] text-muted-foreground">0 = pergunta aberta não pontua.</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor={`tmc-${question.id}`}>
                  Mínimo de caracteres
                </Label>
                <Input
                  id={`tmc-${question.id}`}
                  type="number"
                  min={1}
                  max={2000}
                  value={textMinChars}
                  onChange={(e) => setTextMinChars(Math.max(1, Number(e.target.value) || 1))}
                />
                <p className="text-[11px] text-muted-foreground">
                  Respostas mais curtas não pontuam.
                </p>
              </div>
            </div>
          ) : null}

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
