import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ClipboardList, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SurveyField } from "@/components/surveys/survey-form-fields";
import { isAnswered, type SurveyQuestion } from "@/lib/surveys/survey-fields";
import {
  getSurveyForm,
  listAvailableSurveys,
  saveSurveyActivity,
  type SurveySourceKind,
} from "@/lib/surveys/survey-activity.functions";
import type { RelatedKey } from "@/components/activity/timeline-shared";

type Selection = { source: SurveySourceKind; id: string };

function encode(s: Selection) {
  return `${s.source}:${s.id}`;
}

function decode(v: string): Selection | null {
  const [source, id] = v.split(":");
  if (!id) return null;
  if (source !== "survey_template" && source !== "prospecting_questionnaire") return null;
  return { source, id };
}

/** Modal para responder uma pesquisa e registrá-la como atividade. */
export function SurveyActivityDialog({
  open,
  onOpenChange,
  relatedKey,
  relatedId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  relatedKey: RelatedKey;
  relatedId: string;
  onSaved?: () => void;
}) {
  const listFn = useServerFn(listAvailableSurveys);
  const formFn = useServerFn(getSurveyForm);
  const saveFn = useServerFn(saveSurveyActivity);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [notes, setNotes] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const available = useQuery({
    queryKey: ["survey-activity", "available"],
    queryFn: () => listFn(),
    enabled: open,
  });

  const form = useQuery({
    queryKey: ["survey-activity", "form", selection?.source, selection?.id],
    queryFn: () => formFn({ data: { source: selection!.source, source_id: selection!.id } }),
    enabled: open && !!selection,
  });

  useEffect(() => {
    if (!open) {
      setSelection(null);
      setAnswers({});
      setNotes("");
      setShowErrors(false);
    }
  }, [open]);

  useEffect(() => {
    setAnswers({});
    setShowErrors(false);
  }, [selection?.id]);

  const questions = useMemo<SurveyQuestion[]>(
    () => (form.data?.questions ?? []) as SurveyQuestion[],
    [form.data],
  );

  const missing = useMemo(
    () => questions.filter((q) => q.required && !isAnswered(answers[q.id])).map((q) => q.id),
    [questions, answers],
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!selection) throw new Error("Selecione uma pesquisa.");
      return saveFn({
        data: {
          source: selection.source,
          source_id: selection.id,
          related_key: relatedKey,
          related_id: relatedId,
          answers,
          notes: notes.trim() || null,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(
        res.score != null && res.max_score
          ? `Pesquisa registrada (score ${res.score}/${res.max_score}).`
          : "Pesquisa registrada na timeline.",
      );
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao registrar pesquisa."),
  });

  const templates = available.data?.templates ?? [];
  const questionnaires = available.data?.questionnaires ?? [];
  const hasOptions = templates.length > 0 || questionnaires.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" aria-hidden />
            Responder pesquisa
          </DialogTitle>
          <DialogDescription>
            Escolha uma pesquisa e registre as respostas como atividade nesta entidade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="survey-source" className="text-xs font-medium">
              Pesquisa
            </Label>
            {available.isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : available.isError ? (
              <p className="text-sm text-destructive" role="alert">
                Não foi possível carregar as pesquisas.{" "}
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => void available.refetch()}>
                  Tentar novamente
                </Button>
              </p>
            ) : !hasOptions ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma pesquisa ativa encontrada. Crie um modelo em Pesquisas ou um questionário em
                Prospecção.
              </p>
            ) : (
              <Select
                value={selection ? encode(selection) : ""}
                onValueChange={(v) => setSelection(decode(v))}
              >
                <SelectTrigger id="survey-source">
                  <SelectValue placeholder="Selecione a pesquisa…" />
                </SelectTrigger>
                <SelectContent>
                  {templates.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Modelos de pesquisa</SelectLabel>
                      {templates.map((t) => (
                        <SelectItem
                          key={t.id}
                          value={encode({ source: "survey_template", id: t.id })}
                        >
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {questionnaires.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Questionários de qualificação</SelectLabel>
                      {questionnaires.map((q) => (
                        <SelectItem
                          key={q.id}
                          value={encode({ source: "prospecting_questionnaire", id: q.id })}
                        >
                          {q.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {selection && (
            <div className="space-y-3 rounded-lg border border-border/60 p-3">
              {form.isLoading ? (
                <div className="space-y-3" aria-live="polite">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : form.isError ? (
                <p className="text-sm text-destructive" role="alert">
                  Erro ao carregar o formulário.{" "}
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => void form.refetch()}>
                    Tentar novamente
                  </Button>
                </p>
              ) : questions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Esta pesquisa ainda não tem perguntas configuradas.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">{form.data?.name}</p>
                    <Badge variant="secondary" className="text-[10px]">
                      {questions.length} {questions.length === 1 ? "pergunta" : "perguntas"}
                    </Badge>
                  </div>
                  <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
                    {questions.map((q) => (
                      <SurveyField
                        key={q.id}
                        question={q}
                        value={answers[q.id]}
                        invalid={showErrors && missing.includes(q.id)}
                        onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                      />
                    ))}
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="survey-notes" className="text-xs font-medium">
                  Observações (opcional)
                </Label>
                <Textarea
                  id="survey-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (missing.length > 0) {
                setShowErrors(true);
                toast.error("Responda as perguntas obrigatórias.");
                return;
              }
              save.mutate();
            }}
            disabled={!selection || form.isLoading || save.isPending}
          >
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            Registrar pesquisa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
