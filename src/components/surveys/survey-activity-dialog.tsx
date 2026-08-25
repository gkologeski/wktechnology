import { useEffect, useMemo, useState, useRef, lazy, Suspense } from "react";
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
import type { SurveyKindTab } from "@/components/surveys/survey-type-picker-dialog";
import { parseFieldLayout } from "@/lib/prospecting/field-layout";
import { Progress } from "@/components/ui/progress";
import {
  computeQualificationScore,
  computeQualificationMaxScore,
  scorePercent,
  type ScoreQuestion,
} from "@/lib/prospecting/score";
import { QualificationQuestionInput } from "@/components/prospecting/qualification-question-input";
import { getLeadIcpFit } from "@/lib/scoring/icp.functions";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { QUESTIONNAIRES_CREATE, asKeys } from "@/lib/prospecting/permission-keys";
import {
  QualificationEntityBlocks,
  useQualificationEntityFields,
} from "@/components/prospecting/qualification-entity-fields";
import { notifyTimelineRefresh } from "@/lib/timeline-refresh";

/** Tela padrão de qualificação (Apollo, campos, score, decisão) sob demanda. */
const QualificationPanel = lazy(() =>
  import("@/components/prospecting/qualification-panel").then((m) => ({
    default: m.QualificationPanel,
  })),
);

type Selection = { source: SurveySourceKind; id: string };

const ICP_LABEL: Record<string, string> = {
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
  unknown: "Sem critérios",
};
const ICP_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  high: "default",
  medium: "secondary",
  low: "outline",
  unknown: "outline",
};

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
  initialSource,
  initialSourceId,
  activityId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  relatedKey: RelatedKey;
  relatedId: string;
  onSaved?: () => void;
  /** Abre já com esta pesquisa selecionada (ex.: pendência criada por workflow). */
  initialSource?: SurveySourceKind;
  initialSourceId?: string;
  /** Atividade de pesquisa pendente que será concluída com as respostas. */
  activityId?: string;
}) {
  const listFn = useServerFn(listAvailableSurveys);
  const formFn = useServerFn(getSurveyForm);
  const saveFn = useServerFn(saveSurveyActivity);

  const [kind, setKind] = useState<SurveyKindTab | "">("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [notes, setNotes] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const preselectedRef = useRef(false);

  const available = useQuery({
    queryKey: ["survey-activity", "available"],
    queryFn: () => listFn(),
    enabled: open,
  });

  const { canAny } = usePermissions();
  const canCreateSurvey = canAny(asKeys(QUESTIONNAIRES_CREATE));

  const form = useQuery({
    queryKey: ["survey-activity", "form", selection?.source, selection?.id],
    queryFn: () => formFn({ data: { source: selection!.source, source_id: selection!.id } }),
    enabled: open && !!selection,
  });

  useEffect(() => {
    if (!open) {
      setKind("");
      setSelection(null);
      setAnswers({});
      setNotes("");
      setShowErrors(false);
    }
  }, [open]);

  // Pesquisa pré-selecionada (pendência criada por workflow).
  useEffect(() => {
    if (!open || !initialSource || !initialSourceId) return;
    preselectedRef.current = true;
    setKind(initialSource === "prospecting_questionnaire" ? "vendas" : "livre");
    setSelection({ source: initialSource, id: initialSourceId });
  }, [open, initialSource, initialSourceId]);

  useEffect(() => {
    setAnswers({});
    setShowErrors(false);
  }, [selection?.id]);

  useEffect(() => {
    // Preserva a seleção quando o tipo foi definido por uma pendência de workflow.
    if (preselectedRef.current) {
      preselectedRef.current = false;
      return;
    }
    setSelection(null);
  }, [kind]);

  const questions = useMemo<SurveyQuestion[]>(
    () => (form.data?.questions ?? []) as SurveyQuestion[],
    [form.data],
  );

  const missing = useMemo(
    () => questions.filter((q) => q.required && !isAnswered(answers[q.id])).map((q) => q.id),
    [questions, answers],
  );

  // Pesquisas de vendas usam o renderizador e o score da qualificação.
  const isSalesForm = selection?.source === "prospecting_questionnaire";
  const scoreQuestions = useMemo(
    () => (isSalesForm ? (form.data?.questions ?? []) : []) as unknown as ScoreQuestion[],
    [isSalesForm, form.data],
  );
  const score = useMemo(
    () => (isSalesForm ? computeQualificationScore(scoreQuestions, answers) : 0),
    [isSalesForm, scoreQuestions, answers],
  );
  const maxInfo = useMemo(
    () =>
      isSalesForm ? computeQualificationMaxScore(scoreQuestions) : { max: 0, hasOpenEnded: false },
    [isSalesForm, scoreQuestions],
  );
  const percent = scorePercent(score, maxInfo.max);
  const threshold = form.data?.pass_threshold ?? null;

  // Fit de ICP do lead (critérios de Prospecção → Scoring).
  const icpFitFn = useServerFn(getLeadIcpFit);
  const isLead = relatedKey === "related_lead_id";
  const icpFit = useQuery({
    queryKey: ["scoring", "icp-fit", relatedId],
    queryFn: () => icpFitFn({ data: { lead_id: relatedId } }),
    enabled: open && isLead && isSalesForm && !!relatedId,
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!selection) throw new Error("Selecione uma pesquisa.");
      if (isSalesLead && fieldLayout.length > 0) await entityFields.saveAll();
      return saveFn({
        data: {
          ...(activityId ? { activity_id: activityId } : {}),
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
      notifyTimelineRefresh();
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao registrar pesquisa."),
  });

  // Opções da pesquisa conforme o tipo escolhido.
  const options = useMemo<Array<{ selection: Selection; name: string; group: string }>>(() => {
    const d = available.data;
    if (!d) return [];
    const tpl = (rows: Array<{ id: string; name: string }>, group: string) =>
      rows.map((r) => ({
        selection: { source: "survey_template" as SurveySourceKind, id: r.id },
        name: r.name,
        group,
      }));
    const qst = (rows: Array<{ id: string; name: string }>, group: string) =>
      rows.map((r) => ({
        selection: { source: "prospecting_questionnaire" as SurveySourceKind, id: r.id },
        name: r.name,
        group,
      }));
    if (kind === "csat") return tpl(d.csat, "CSAT");
    if (kind === "nps") return tpl(d.nps, "NPS");
    if (kind === "livre") return tpl(d.free, "Formulários livres");
    if (kind === "vendas")
      return [
        ...qst(d.salesModels, "Modelos de qualificação"),
        ...qst(d.salesQuestionnaires, "Questionários"),
      ];
    return [];
  }, [available.data, kind]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof options>();
    for (const o of options) map.set(o.group, [...(map.get(o.group) ?? []), o]);
    return [...map.entries()];
  }, [options]);

  // Campos de entidades (só para pesquisas de vendas em leads).
  const isSalesLead = kind === "vendas" && relatedKey === "related_lead_id";
  // Pesquisa de vendas em lead: usa a tela padrão de qualificação.
  const useQualificationScreen = isSalesLead && selection?.source === "prospecting_questionnaire";
  const fieldLayout = useMemo(
    () => (isSalesLead ? parseFieldLayout(form.data?.field_layout ?? null) : []),
    [isSalesLead, form.data],
  );
  const entityFields = useQualificationEntityFields(isSalesLead ? relatedId : "", fieldLayout);
  const blocksBefore = fieldLayout.filter((b) => b.position === "before");
  const blocksAfter = fieldLayout.filter((b) => b.position === "after");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={useQualificationScreen ? "max-w-4xl" : "max-w-2xl"}>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="survey-kind" className="text-xs font-medium">
                Tipo de pesquisa
              </Label>
              <Select value={kind} onValueChange={(v) => setKind(v as SurveyKindTab)}>
                <SelectTrigger id="survey-kind">
                  <SelectValue placeholder="Selecione o tipo…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csat">CSAT</SelectItem>
                  <SelectItem value="nps">NPS</SelectItem>
                  <SelectItem value="vendas">Vendas</SelectItem>
                  <SelectItem value="livre">Livre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="survey-source" className="text-xs font-medium">
                Pesquisa
              </Label>
              {available.isLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : available.isError ? (
                <p className="text-sm text-destructive" role="alert">
                  Não foi possível carregar as pesquisas.{" "}
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() => void available.refetch()}
                  >
                    Tentar novamente
                  </Button>
                </p>
              ) : !kind ? (
                <p className="text-sm text-muted-foreground">Escolha o tipo primeiro.</p>
              ) : options.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {canCreateSurvey
                    ? "Nenhuma pesquisa ativa deste tipo. Crie uma em Pesquisas."
                    : "Nenhuma pesquisa ativa deste tipo disponível para você. Peça ao administrador do workspace para ativar uma pesquisa ou liberar seu acesso."}
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
                    {groups.map(([group, items]) => (
                      <SelectGroup key={group}>
                        <SelectLabel>{group}</SelectLabel>
                        {items.map((o) => (
                          <SelectItem key={o.selection.id} value={encode(o.selection)}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {useQualificationScreen && selection ? (
            <Suspense
              fallback={
                <div className="space-y-3" aria-live="polite">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              }
            >
              <div className="max-h-[70vh] overflow-y-auto pr-1">
                <QualificationPanel
                  key={selection.id}
                  entity="lead"
                  entityId={relatedId}
                  preselectedQuestionnaireId={selection.id}
                  activityId={activityId ?? null}
                  onDecided={() => {
                    notifyTimelineRefresh();
                    onSaved?.();
                    onOpenChange(false);
                  }}
                />
              </div>
            </Suspense>
          ) : null}

          {!useQualificationScreen && selection && (
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
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() => void form.refetch()}
                  >
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
                  {isSalesForm && maxInfo.max > 0 && (
                    <div className="rounded-md border border-border/60 bg-muted/30 p-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Score
                        </p>
                        <p
                          className={
                            threshold != null && score >= threshold
                              ? "text-sm font-semibold text-emerald-600"
                              : "text-sm font-semibold text-foreground"
                          }
                        >
                          {score}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            de {maxInfo.max}
                            {percent != null ? ` (${percent}%)` : ""}
                          </span>
                        </p>
                      </div>
                      <Progress
                        value={percent ?? 0}
                        className="mt-1 h-1.5"
                        aria-label={`Score ${score} de ${maxInfo.max}`}
                      />
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {threshold != null ? `Corte ${threshold}` : "Sem corte definido"}
                        {maxInfo.hasOpenEnded ? " · há perguntas sem teto" : ""}
                      </p>
                      {isLead && icpFit.data && icpFit.data.criteriaCount > 0 ? (
                        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Fit ICP
                          </p>
                          <Badge
                            variant={ICP_BADGE[icpFit.data.level] ?? "outline"}
                            className="text-[10px]"
                          >
                            {ICP_LABEL[icpFit.data.level] ?? icpFit.data.level}
                            {icpFit.data.percent != null ? ` · ${icpFit.data.percent}%` : ""}
                          </Badge>
                        </div>
                      ) : null}
                    </div>
                  )}
                  <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
                    {isSalesLead && blocksBefore.length > 0 && (
                      <QualificationEntityBlocks
                        blocks={blocksBefore}
                        records={entityFields.records}
                        values={entityFields.values}
                        onChange={entityFields.setValue}
                        isLoading={entityFields.isLoading}
                        autofilled={entityFields.autofilled}
                      />
                    )}
                    {questions.map((q) =>
                      isSalesForm ? (
                        <QualificationQuestionInput
                          key={q.id}
                          question={{
                            id: q.id,
                            label: q.label,
                            type: q.type,
                            options: q.options,
                            required: q.required,
                            help_text: q.help_text,
                          }}
                          value={answers[q.id]}
                          invalid={showErrors && missing.includes(q.id)}
                          onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                        />
                      ) : (
                        <SurveyField
                          key={q.id}
                          question={q}
                          value={answers[q.id]}
                          invalid={showErrors && missing.includes(q.id)}
                          onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                        />
                      ),
                    )}
                    {isSalesLead && blocksAfter.length > 0 && (
                      <QualificationEntityBlocks
                        blocks={blocksAfter}
                        records={entityFields.records}
                        values={entityFields.values}
                        onChange={entityFields.setValue}
                        isLoading={entityFields.isLoading}
                        autofilled={entityFields.autofilled}
                      />
                    )}
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
            {useQualificationScreen ? "Fechar" : "Cancelar"}
          </Button>
          {useQualificationScreen ? null : (
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
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
