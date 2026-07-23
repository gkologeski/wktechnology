/**
 * Painel de qualificação — renderiza um questionário ativo para um lead/contato,
 * calcula score em tempo real e permite decisão manual final do SDR.
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, X, Clock, Calendar as CalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listQuestionnaires, getQuestionnaire } from "@/lib/prospecting/questionnaires.functions";
import {
  saveQualification,
  listQualificationsForEntity,
} from "@/lib/prospecting/qualifications.functions";

type Entity = "lead" | "contact";
type Decision = "qualified" | "disqualified" | "nurture" | "scheduled";

export function QualificationPanel({
  entity,
  entityId,
}: {
  entity: Entity;
  entityId: string;
}) {
  const listQ = useServerFn(listQuestionnaires);
  const getQ = useServerFn(getQuestionnaire);
  const listExisting = useServerFn(listQualificationsForEntity);
  const save = useServerFn(saveQualification);
  const qc = useQueryClient();

  const { data: questionnaires } = useQuery({
    queryKey: ["prospecting", "questionnaires"],
    queryFn: () => listQ(),
  });

  const enabled = (questionnaires ?? []).filter((q) => q.enabled);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeId = selectedId ?? enabled[0]?.id ?? null;

  const { data: qData } = useQuery({
    queryKey: ["prospecting", "questionnaire", activeId],
    queryFn: () => (activeId ? getQ({ data: { id: activeId } }) : null),
    enabled: !!activeId,
  });

  const { data: existing } = useQuery({
    queryKey: ["prospecting", "qualifications", entity, entityId],
    queryFn: () => listExisting({ data: { entity, entity_id: entityId } }),
  });

  const existingForActive = existing?.find(
    (e) => e.questionnaire_id === activeId,
  );

  const [answers, setAnswers] = useState<Record<string, unknown>>(
    (existingForActive?.answers as Record<string, unknown>) ?? {},
  );
  const [decision, setDecision] = useState<Decision | "">("");
  const [reason, setReason] = useState("");

  const score = useMemo(() => {
    if (!qData) return 0;
    let total = 0;
    for (const q of qData.questions) {
      const raw = answers[q.id];
      if (raw == null) continue;
      const opts = Array.isArray(q.options)
        ? (q.options as { label: string; points: number }[])
        : [];
      if (q.type === "number") {
        const n = Number(raw);
        if (Number.isFinite(n)) total += n * (q.weight ?? 1);
      } else if (q.type === "boolean") {
        if (raw === true) total += 10 * (q.weight ?? 1);
      } else if (q.type === "single") {
        const opt = opts.find((o) => o.label === raw);
        if (opt) total += (opt.points ?? 0) * (q.weight ?? 1);
      } else if (q.type === "multi" && Array.isArray(raw)) {
        for (const label of raw) {
          const opt = opts.find((o) => o.label === label);
          if (opt) total += (opt.points ?? 0) * (q.weight ?? 1);
        }
      }
    }
    return total;
  }, [answers, qData]);

  const threshold = qData?.questionnaire.pass_threshold ?? 0;
  const passesAuto = score >= threshold;

  const saveMut = useMutation({
    mutationFn: (finalDecision?: Decision) =>
      save({
        data: {
          id: existingForActive?.id,
          questionnaire_id: activeId!,
          entity,
          entity_id: entityId,
          answers,
          ...(finalDecision
            ? { decision: finalDecision, decision_reason: reason || null }
            : {}),
        },
      }),
    onSuccess: (_r, finalDecision) => {
      toast.success(
        finalDecision ? "Decisão registrada." : "Qualificação salva.",
      );
      qc.invalidateQueries({
        queryKey: ["prospecting", "qualifications", entity, entityId],
      });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!enabled.length) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Nenhum questionário ativo. Crie um em <strong>Prospecção → Questionários</strong>.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Qualificação</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Preencha as respostas e defina a decisão final.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Score</p>
            <p
              className={`text-lg font-semibold ${
                passesAuto ? "text-emerald-600" : "text-foreground"
              }`}
            >
              {score}
              <span className="text-xs text-muted-foreground ml-1">/ corte {threshold}</span>
            </p>
          </div>
          <Select value={activeId ?? ""} onValueChange={setSelectedId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent>
              {enabled.map((q) => (
                <SelectItem key={q.id} value={q.id}>
                  {q.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {qData ? (
          qData.questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este questionário não tem perguntas ainda.
            </p>
          ) : (
            <div className="space-y-4">
              {qData.questions.map((q) => (
                <QuestionInput
                  key={q.id}
                  question={q}
                  value={answers[q.id]}
                  onChange={(v) => setAnswers({ ...answers, [q.id]: v })}
                />
              ))}
            </div>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        )}

        <div className="border-t pt-4 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Motivo / observações (opcional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Justificativa da decisão, próximos passos, etc."
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={saveMut.isPending}
              onClick={() => saveMut.mutate(undefined)}
            >
              Salvar rascunho
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={saveMut.isPending}
              onClick={() => saveMut.mutate("qualified")}
            >
              <Check className="w-4 h-4 mr-1" /> Qualificar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={saveMut.isPending}
              onClick={() => saveMut.mutate("scheduled")}
            >
              <CalIcon className="w-4 h-4 mr-1" /> Agendado
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={saveMut.isPending}
              onClick={() => saveMut.mutate("nurture")}
            >
              <Clock className="w-4 h-4 mr-1" /> Nutrição
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={saveMut.isPending}
              onClick={() => saveMut.mutate("disqualified")}
            >
              <X className="w-4 h-4 mr-1" /> Desqualificar
            </Button>
          </div>
          {existingForActive?.decision && existingForActive.decision !== "pending" ? (
            <Badge variant="outline">
              Última decisão: <span className="ml-1 font-medium">{existingForActive.decision}</span>
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: {
    id: string;
    label: string;
    type: string;
    options: unknown;
    required: boolean;
    help_text: string | null;
  };
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const opts = Array.isArray(question.options)
    ? (question.options as { label: string; points: number }[])
    : [];

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {question.label}
        {question.required ? <span className="text-destructive ml-1">*</span> : null}
      </Label>
      {question.help_text ? (
        <p className="text-xs text-muted-foreground">{question.help_text}</p>
      ) : null}
      {question.type === "text" ? (
        <Textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
        />
      ) : question.type === "number" ? (
        <Input
          type="number"
          value={(value as number) ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      ) : question.type === "boolean" ? (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={value === true}
            onCheckedChange={(v) => onChange(v === true)}
          />
          <span className="text-sm">Sim</span>
        </div>
      ) : question.type === "single" ? (
        <Select value={(value as string) ?? ""} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {opts.map((o) => (
              <SelectItem key={o.label} value={o.label}>
                {o.label}{" "}
                <span className="text-xs text-muted-foreground ml-1">({o.points} pts)</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : question.type === "multi" ? (
        <div className="space-y-1">
          {opts.map((o) => {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            const checked = arr.includes(o.label);
            return (
              <label key={o.label} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    if (v) onChange([...arr, o.label]);
                    else onChange(arr.filter((x) => x !== o.label));
                  }}
                />
                <span>
                  {o.label}{" "}
                  <span className="text-xs text-muted-foreground ml-1">({o.points} pts)</span>
                </span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
