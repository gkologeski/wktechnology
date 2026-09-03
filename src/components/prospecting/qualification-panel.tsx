/**
 * Painel de qualificação — renderiza um questionário ativo para um lead,
 * calcula score em tempo real e permite decisão manual final do SDR:
 * qualificar, desqualificar (motivo obrigatório) ou enviar para nutrição.
 *
 * Também exibe blocos de campos de entidades (Lead/Empresa/Contato)
 * configuráveis por questionário, antes ou depois das perguntas.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, X, Clock, Settings2, Sparkles, RefreshCw, Linkedin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listQuestionnaires, getQuestionnaire } from "@/lib/prospecting/questionnaires.functions";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { QUESTIONNAIRES_CREATE, asKeys } from "@/lib/prospecting/permission-keys";
import {
  computeQualificationScore,
  computeQualificationMaxScore,
  scorePercent,
  type ScoreQuestion,
} from "@/lib/prospecting/score";
import { getLeadIcpFit } from "@/lib/scoring/icp.functions";
import {
  computeUnifiedLeadScore,
  LEAD_SCORE_MAX,
  QUESTIONNAIRE_MAX_POINTS,
  ICP_MAX_POINTS,
} from "@/lib/prospecting/lead-score";
import { LeadScoreBadge } from "@/components/prospecting/lead-score-badge";
import { Progress } from "@/components/ui/progress";
import {
  saveQualification,
  listQualificationsForEntity,
  nurtureLead,
} from "@/lib/prospecting/qualifications.functions";
import { getDealLossReasons } from "@/lib/deal-loss-reasons.functions";
import { parseFieldLayout } from "@/lib/prospecting/field-layout";
import {
  QualificationEntityBlocks,
  useQualificationEntityFields,
} from "@/components/prospecting/qualification-entity-fields";
import { QualificationFieldLayoutDialog } from "@/components/prospecting/qualification-field-layout-dialog";
import { QualificationQuestionInput } from "@/components/prospecting/qualification-question-input";
import {
  enrichLeadForQualification,
  applyQualificationEnrichment,
} from "@/lib/prospecting/qualification-enrichment.functions";
import { EnrichmentSourcesCard } from "@/components/prospecting/enrichment-sources-card";
import { normalizeLinkedinUrl } from "@/lib/prospecting/linkedin-url";
import { markLinkedinEnriched } from "@/lib/prospecting/use-linkedin-enrichment";
import { useLeadStages } from "@/lib/leads/stages";
import { PermissionDeniedError } from "@/lib/access-control/rls-denied";
import { handlePermissionError } from "@/lib/access-control/handle-permission-error";
import { notifyTimelineRefresh } from "@/lib/timeline-refresh";
import { saveSurveyActivity } from "@/lib/surveys/survey-activity.functions";

type Entity = "lead" | "contact";

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

export function QualificationPanel({
  entity,
  entityId,
  preselectedQuestionnaireId,
  queueId,
  activityId,
  onDecided,
}: {
  entity: Entity;
  entityId: string;
  preselectedQuestionnaireId?: string | null;
  queueId?: string | null;
  /** Atividade de pesquisa (criada por workflow) a ser concluída na decisão. */
  activityId?: string | null;
  onDecided?: (decision: "qualified" | "disqualified" | "nurture") => void;
}) {
  const listQ = useServerFn(listQuestionnaires);
  const getQ = useServerFn(getQuestionnaire);
  const listExisting = useServerFn(listQualificationsForEntity);
  const save = useServerFn(saveQualification);
  const nurtureFn = useServerFn(nurtureLead);
  const listLossReasons = useServerFn(getDealLossReasons);
  const saveSurvey = useServerFn(saveSurveyActivity);
  const qc = useQueryClient();

  const {
    data: questionnaires,
    isLoading: loadingQuestionnaires,
    isError: questionnairesError,
  } = useQuery({
    queryKey: ["prospecting", "questionnaires"],
    queryFn: () => listQ(),
  });
  const { canAny } = usePermissions();
  const canCreateQuestionnaire = canAny(asKeys(QUESTIONNAIRES_CREATE));

  const enabled = (questionnaires ?? []).filter((q) => q.enabled);
  const [selectedId, setSelectedId] = useState<string | null>(preselectedQuestionnaireId ?? null);

  const activeId = selectedId ?? preselectedQuestionnaireId ?? enabled[0]?.id ?? null;

  const { data: qData } = useQuery({
    queryKey: ["prospecting", "questionnaire", activeId],
    queryFn: () => (activeId ? getQ({ data: { id: activeId } }) : null),
    enabled: !!activeId,
  });

  const { data: existing } = useQuery({
    queryKey: ["prospecting", "qualifications", entity, entityId],
    queryFn: () => listExisting({ data: { entity, entity_id: entityId } }),
  });

  const existingForActive = existing?.find((e) => e.questionnaire_id === activeId);

  const [answers, setAnswers] = useState<Record<string, unknown>>(
    (existingForActive?.answers as Record<string, unknown>) ?? {},
  );
  const [reason, setReason] = useState("");

  // Sincroniza respostas quando o registro existente carrega ou muda de questionário.
  useEffect(() => {
    setAnswers((existingForActive?.answers as Record<string, unknown>) ?? {});
    setReason("");
  }, [existingForActive?.id, activeId]);

  // Fit de ICP do lead (critérios configurados em Prospecção → Scoring).
  const icpFitFn = useServerFn(getLeadIcpFit);
  const icpFit = useQuery({
    queryKey: ["scoring", "icp-fit", entityId],
    queryFn: () => icpFitFn({ data: { lead_id: entityId } }),
    enabled: entity === "lead" && !!entityId,
    staleTime: 60_000,
  });

  const score = useMemo(
    () => (qData ? computeQualificationScore(qData.questions as ScoreQuestion[], answers) : 0),
    [answers, qData],
  );
  const maxInfo = useMemo(
    () =>
      qData
        ? computeQualificationMaxScore(qData.questions as ScoreQuestion[])
        : { max: 0, hasOpenEnded: false },
    [qData],
  );
  const percent = scorePercent(score, maxInfo.max);

  // Nota unificada do lead (0–85): questionário (até 50) + ICP (até 35).
  const unified = useMemo(
    () =>
      computeUnifiedLeadScore({
        questionnaireScore: score,
        questionnaireMax: maxInfo.max,
        icpScore: icpFit.data?.points ?? 0,
        icpMax: icpFit.data?.max ?? 0,
      }),
    [score, maxInfo.max, icpFit.data?.points, icpFit.data?.max],
  );

  const threshold = qData?.questionnaire.pass_threshold ?? 0;
  const passesAuto = score >= threshold;

  const missingRequired = useMemo(() => {
    if (!qData) return [] as string[];
    const missing: string[] = [];
    for (const q of qData.questions) {
      if (!q.required) continue;
      const v = answers[q.id];
      const empty =
        v == null ||
        (typeof v === "string" && v.trim() === "") ||
        (Array.isArray(v) && v.length === 0);
      if (empty) missing.push(q.label);
    }
    return missing;
  }, [qData, answers]);

  // ---------- Campos de entidades configurados por questionário ----------
  const fieldLayout = useMemo(
    () =>
      parseFieldLayout(
        (qData?.questionnaire as { field_layout?: unknown } | undefined)?.field_layout,
      ),
    [qData],
  );
  const blocksBefore = fieldLayout.filter((b) => b.position === "before");
  const blocksAfter = fieldLayout.filter((b) => b.position === "after");
  const entityFields = useQualificationEntityFields(entityId, fieldLayout);
  const [layoutOpen, setLayoutOpen] = useState(false);

  // ---------- Enriquecimento Apollo.io (domínio → empresa → pessoa) ----------
  const enrichFn = useServerFn(enrichLeadForQualification);
  const applyEnrichFn = useServerFn(applyQualificationEnrichment);
  const [refreshKey, setRefreshKey] = useState(0);
  /** LinkedIn enviado ao provedor no último disparo manual. */
  const [linkedinParam, setLinkedinParam] = useState<string | null>(null);
  const [linkedinInput, setLinkedinInput] = useState("");
  const [linkedinTouched, setLinkedinTouched] = useState(false);
  const [linkedinError, setLinkedinError] = useState<string | null>(null);
  const enrichment = useQuery({
    queryKey: ["qualification-enrichment", entityId, refreshKey, linkedinParam],
    queryFn: () =>
      enrichFn({
        data: {
          leadId: entityId,
          force: refreshKey > 0,
          ...(linkedinParam ? { linkedinUrl: linkedinParam } : {}),
        },
      }),
    enabled: !!entityId,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Espelha no campo o LinkedIn já conhecido do lead, sem atropelar a digitação.
  const knownLinkedin = enrichment.data?.linkedinUrl ?? null;
  useEffect(() => {
    if (linkedinTouched) return;
    setLinkedinInput(knownLinkedin ?? "");
  }, [knownLinkedin, linkedinTouched]);

  // Registra a URL já usada aqui para que salvar propriedades na tela do lead
  // não repita o enriquecimento (nem o toast) para o mesmo LinkedIn.
  useEffect(() => {
    if (knownLinkedin) markLinkedinEnriched(entityId, knownLinkedin);
  }, [entityId, knownLinkedin]);

  /** Valida a URL e dispara o enriquecimento usando o LinkedIn como chave. */
  function enrichByLinkedin() {
    const parsed = normalizeLinkedinUrl(linkedinInput);
    if (!parsed.ok) {
      setLinkedinError(parsed.error);
      return;
    }
    setLinkedinError(null);
    setLinkedinInput(parsed.url);
    setLinkedinParam(parsed.url);
    setRefreshKey((k) => k + 1);
  }

  const suggestions = useMemo(
    () =>
      enrichment.data
        ? {
            leads: enrichment.data.lead,
            companies: enrichment.data.companies,
            contacts: enrichment.data.contacts,
          }
        : undefined,
    [enrichment.data],
  );

  // Preenche automaticamente os campos vazios quando as sugestões chegam
  // (independente da ordem de carregamento dos registros).
  const applySuggestions = entityFields.applySuggestions;
  useEffect(() => {
    if (!suggestions) return;
    applySuggestions(suggestions);
  }, [suggestions, applySuggestions]);

  // O enriquecimento grava os campos vazios direto no banco: refaz as
  // consultas da tela para refletir os valores sem precisar recarregar.
  const appliedSignature = enrichment.data?.applied
    ? JSON.stringify(enrichment.data.applied)
    : null;
  useEffect(() => {
    if (!appliedSignature || appliedSignature === '{"leads":[],"companies":[],"contacts":[]}')
      return;
    qc.invalidateQueries({ queryKey: ["qualification-entity-records", entityId] });
    qc.invalidateQueries({ queryKey: ["lead", entityId] });
    qc.invalidateQueries({ queryKey: ["leads"] });
  }, [appliedSignature, entityId, qc]);

  /**
   * Conclui a atividade de pesquisa criada pelo workflow, registrando as
   * respostas. Falhas aqui não bloqueiam a decisão de qualificação.
   */
  async function completeSurveyActivity(notes?: string | null) {
    if (!activityId || !activeId) return;
    try {
      await saveSurvey({
        data: {
          activity_id: activityId,
          related_key: "related_lead_id",
          related_id: entityId,
          source: "prospecting_questionnaire",
          source_id: activeId,
          answers,
          notes: notes ?? null,
        },
      });
    } catch (e) {
      toast.error(
        `Qualificação salva, mas a atividade de pesquisa não foi concluída: ${(e as Error).message}`,
      );
    }
  }

  /** Persiste no banco todos os campos enriquecidos (lead, empresa e contato). */
  async function persistEnrichment() {
    if (!enrichment.data?.found) return;
    try {
      await applyEnrichFn({
        data: {
          leadId: entityId,
          lead: enrichment.data.lead,
          companies: enrichment.data.companies,
          contacts: enrichment.data.contacts,
        },
      });
    } catch (e) {
      // Enriquecimento é complementar: não bloqueia a qualificação.
      console.error("Falha ao aplicar enriquecimento", e);
    }
  }

  const { stages, pipelineId } = useLeadStages();
  const qualifiedStage = useMemo(
    () => stages.find((s) => s.value === "qualified") ?? stages.find((s) => s.type === "won"),
    [stages],
  );
  const lostStage = useMemo(
    () => stages.find((s) => s.value === "disqualified") ?? stages.find((s) => s.type === "lost"),
    [stages],
  );
  const nurtureStage = useMemo(() => stages.find((s) => s.value === "nurturing"), [stages]);

  const saveDraft = useMutation({
    mutationFn: async () => {
      await entityFields.saveAll();
      await persistEnrichment();
      return save({
        data: {
          id: existingForActive?.id,
          questionnaire_id: activeId!,
          entity,
          entity_id: entityId,
          answers,
        },
      });
    },
    onSuccess: () => {
      toast.success("Qualificação salva.");
      notifyTimelineRefresh();
      qc.invalidateQueries({
        queryKey: ["prospecting", "qualifications", entity, entityId],
      });
      qc.invalidateQueries({ queryKey: ["qualification-entity-records", entityId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // ---------- Qualificar → registra a qualificação e conclui a etapa ----------
  const [qualifying, setQualifying] = useState(false);

  async function confirmQualify() {
    if (!activeId) return;
    setQualifying(true);
    try {
      // 1) grava os campos de entidade editados nos blocos configurados
      await entityFields.saveAll();
      // 1.1) persiste os campos enriquecidos (lead, empresa e contato)
      await persistEnrichment();
      // 2) conclui a atividade de pesquisa criada pelo workflow (se houver),
      //    para que o registro da qualificação reaproveite a mesma atividade
      await completeSurveyActivity(reason || null);
      // 3) registra a qualificação (respostas + score + observações)
      await save({
        data: {
          id: existingForActive?.id,
          questionnaire_id: activeId,
          entity,
          entity_id: entityId,
          answers,
          decision: "qualified",
          decision_reason: reason || null,
          activity_id: activityId ?? null,
        },
      });
      // 4) move o lead para a etapa de qualificado do funil
      const patch: Record<string, unknown> = { status: "qualified" };
      if (qualifiedStage) patch.stage_id = qualifiedStage.value;
      const { data: updated, error: leadErr } = await supabase
        .from("leads")
        .update(patch as never)
        .eq("id", entityId)
        .select("id");
      if (leadErr) throw new Error(leadErr.message);
      if (!updated || updated.length === 0) throw new PermissionDeniedError();

      toast.success("Lead qualificado.");
      notifyTimelineRefresh();
      qc.invalidateQueries({
        queryKey: ["prospecting", "qualifications", entity, entityId],
      });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead", entityId] });
      qc.invalidateQueries({ queryKey: ["qualification-entity-records", entityId] });
      onDecided?.("qualified");
    } catch (e) {
      if (!handlePermissionError(e)) toast.error((e as Error).message);
    } finally {
      setQualifying(false);
    }
  }

  // ---------- Desqualificar → modal com motivo obrigatório ----------
  const [disqualifyOpen, setDisqualifyOpen] = useState(false);
  const [reasonValue, setReasonValue] = useState<string>("");
  const [reasonNote, setReasonNote] = useState<string>("");
  const [disqualifying, setDisqualifying] = useState(false);

  const { data: lossReasons } = useQuery({
    queryKey: ["deal-loss-reasons", "active"],
    queryFn: () => listLossReasons({ data: { includeInactive: false } }),
    enabled: disqualifyOpen,
  });

  async function confirmDisqualify() {
    if (!reasonValue) {
      toast.error("Selecione um motivo.");
      return;
    }
    setDisqualifying(true);
    try {
      const combined = reasonNote.trim() ? `${reasonValue} — ${reasonNote.trim()}` : reasonValue;
      // 1) atualiza status do lead e move para a etapa de perda do funil
      const lostPatch: Record<string, unknown> = { status: "disqualified" };
      if (lostStage) {
        lostPatch.stage_id = lostStage.value;
        if (pipelineId) lostPatch.pipeline_id = pipelineId;
      }
      const { data: updatedLead, error: leadErr } = await supabase
        .from("leads")
        .update(lostPatch as never)
        .eq("id", entityId)
        .select("id");
      if (leadErr) throw new Error(leadErr.message);
      if (!updatedLead || updatedLead.length === 0) throw new PermissionDeniedError();

      // 2) conclui a atividade de pesquisa do workflow (se houver) para que a
      //    qualificação atualize a mesma atividade em vez de criar outra
      await completeSurveyActivity(combined);

      // 3) grava a qualificação com decision + motivo (obrigatório)
      if (activeId) {
        await save({
          data: {
            id: existingForActive?.id,
            questionnaire_id: activeId,
            entity,
            entity_id: entityId,
            answers,
            decision: "disqualified",
            decision_reason: combined,
            activity_id: activityId ?? null,
          },
        });
      }

      toast.success("Lead desqualificado.");
      notifyTimelineRefresh();
      qc.invalidateQueries({
        queryKey: ["prospecting", "qualifications", entity, entityId],
      });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead", entityId] });
      setDisqualifyOpen(false);
      setReasonValue("");
      setReasonNote("");
      onDecided?.("disqualified");
    } catch (e) {
      if (!handlePermissionError(e)) toast.error((e as Error).message);
    } finally {
      setDisqualifying(false);
    }
  }

  // ---------- Enviar para nutrição ----------
  const [nurturing, setNurturing] = useState(false);
  async function sendToNurturing() {
    setNurturing(true);
    try {
      const res = await nurtureFn({
        data: {
          lead_id: entityId,
          questionnaire_id: activeId ?? null,
          answers,
          reason: reason || null,
          queue_id: queueId ?? null,
          qualification_id: existingForActive?.id ?? null,
          stage_id: nurtureStage?.value ?? null,
          pipeline_id: nurtureStage && pipelineId ? pipelineId : null,
        },
      });
      // Encerra a atividade de pesquisa pendente (criada por workflow).
      await completeSurveyActivity(reason || null);

      if (res.enrolled && res.cadence_name) {
        toast.success(`Lead enviado para nutrição — cadência: ${res.cadence_name}.`);
      } else {
        toast.success("Lead enviado para nutrição.");
      }
      qc.invalidateQueries({
        queryKey: ["prospecting", "qualifications", entity, entityId],
      });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead", entityId] });
      qc.invalidateQueries({ queryKey: ["prospecting", "queue-items"] });
      qc.invalidateQueries({ queryKey: ["prospecting", "queue-count"] });
      notifyTimelineRefresh();
      onDecided?.("nurture");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setNurturing(false);
    }
  }

  if (!enabled.length) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground" aria-live="polite">
          {loadingQuestionnaires ? (
            <Skeleton className="h-5 w-64" />
          ) : questionnairesError ? (
            <>
              Não foi possível carregar os questionários de qualificação. Tente novamente em
              instantes.
            </>
          ) : canCreateQuestionnaire ? (
            <>
              Nenhum questionário ativo. Crie um em <strong>Prospecção → Questionários</strong>.
            </>
          ) : (
            <>
              Nenhum questionário de qualificação disponível para você. Peça ao administrador do
              workspace para ativar um questionário em <strong>Prospecção → Questionários</strong>{" "}
              ou liberar seu acesso.
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  const busy = saveDraft.isPending || qualifying || disqualifying || nurturing;
  const missingEntityFields = entityFields.missingRequired;
  const blockedReason =
    missingRequired.length > 0
      ? `Responda os campos obrigatórios: ${missingRequired.join("; ")}`
      : missingEntityFields.length > 0
        ? `Preencha os campos obrigatórios: ${missingEntityFields.join("; ")}`
        : undefined;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Qualificação</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Preencha as respostas e defina a decisão final.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {preselectedQuestionnaireId ? null : (
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
            )}
            {enrichment.isFetching ? (
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3 animate-pulse" aria-hidden="true" />
                Enriquecendo...
              </Badge>
            ) : enrichment.error ? (
              <Badge
                variant="outline"
                className="text-muted-foreground"
                title={(enrichment.error as Error).message}
              >
                Enriquecimento indisponível
              </Badge>
            ) : enrichment.data && !enrichment.data.found && enrichment.data.warnings.length > 0 ? (
              <Badge
                variant="outline"
                className="text-muted-foreground"
                title={enrichment.data.warnings.join(" · ")}
              >
                {enrichment.data.warnings[0]}
              </Badge>
            ) : enrichment.data?.found ? (
              <>
                <Badge
                  variant="secondary"
                  className="gap-1"
                  title={enrichment.data.domain ? `Domínio: ${enrichment.data.domain}` : undefined}
                >
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  Apollo
                  {enrichment.data.personSignal === "linkedin" ? " · via LinkedIn" : ""}
                  {enrichment.data.domain ? ` · ${enrichment.data.domain}` : ""}
                  {enrichment.data.applied &&
                  Object.values(enrichment.data.applied).some((v) => v.length > 0)
                    ? " · gravado"
                    : ""}
                </Badge>
                {enrichment.data.lead?.mobile_phone || enrichment.data.contacts?.mobile_phone ? (
                  <Badge variant="outline" title="Número identificado como celular pelo Apollo.io">
                    Celular encontrado
                  </Badge>
                ) : enrichment.data.phoneRevealPending ? (
                  <Badge
                    variant="outline"
                    className="gap-1 text-muted-foreground"
                    title="O Apollo.io entrega o telefone de forma assíncrona. Assim que o número chegar, ele é gravado automaticamente no lead."
                  >
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    Telefone em revelação
                  </Badge>
                ) : enrichment.data.companies?.phone ? (
                  <Badge
                    variant="outline"
                    className="text-muted-foreground"
                    title="O Apollo.io devolveu apenas o telefone corporativo da empresa."
                  >
                    Apenas telefone corporativo
                  </Badge>
                ) : null}
              </>
            ) : enrichment.data ? (
              <Badge
                variant="outline"
                className="text-muted-foreground"
                title="Informe o site da empresa, um e-mail corporativo ou o LinkedIn do contato para melhorar o enriquecimento."
              >
                Nenhum dado novo encontrado
              </Badge>
            ) : null}

            <Button
              size="sm"
              variant="outline"
              disabled={enrichment.isFetching}
              onClick={() => setRefreshKey((k) => k + 1)}
              title="Reenriquecer com o Apollo.io (ignora o cache)"
            >
              <RefreshCw
                className={`w-4 h-4 mr-1 ${enrichment.isFetching ? "animate-spin" : ""}`}
              />
              Enriquecer
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!activeId}
              onClick={() => setLayoutOpen(true)}
              title="Configurar quais campos aparecem antes ou depois das perguntas"
            >
              <Settings2 className="w-4 h-4 mr-1" /> Configurar campos
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
            <Label htmlFor="qualification-linkedin" className="flex items-center gap-2 text-xs">
              <Linkedin className="h-3.5 w-3.5" aria-hidden="true" />
              LinkedIn do contato
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                id="qualification-linkedin"
                value={linkedinInput}
                placeholder="https://www.linkedin.com/in/nome-sobrenome"
                inputMode="url"
                autoComplete="off"
                aria-invalid={linkedinError ? true : undefined}
                aria-describedby="qualification-linkedin-help"
                disabled={busy || enrichment.isFetching}
                onChange={(e) => {
                  setLinkedinTouched(true);
                  setLinkedinError(null);
                  setLinkedinInput(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    enrichByLinkedin();
                  }
                }}
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0"
                  disabled={busy || enrichment.isFetching || linkedinInput.trim() === ""}
                  onClick={enrichByLinkedin}
                  title="Buscar dados do contato usando o perfil do LinkedIn"
                >
                  <Sparkles
                    className={`w-4 h-4 mr-1 ${enrichment.isFetching ? "animate-pulse" : ""}`}
                    aria-hidden="true"
                  />
                  Enriquecer pelo LinkedIn
                </Button>
                {knownLinkedin ? (
                  <a
                    href={knownLinkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline underline-offset-2"
                  >
                    Abrir perfil
                  </a>
                ) : null}
              </div>
            </div>
            {linkedinError ? (
              <p className="text-xs text-destructive" role="alert">
                {linkedinError}
              </p>
            ) : (
              <p id="qualification-linkedin-help" className="text-xs text-muted-foreground">
                {enrichment.data?.personSignal === "linkedin"
                  ? "Dados localizados a partir do perfil do LinkedIn — só campos vazios foram preenchidos."
                  : "O LinkedIn é o sinal mais preciso: preenche cargo, telefone, celular, empresa e localização automaticamente."}
              </p>
            )}
          </div>

          {enrichment.data?.found ? <EnrichmentSourcesCard enrichment={enrichment.data} /> : null}

          <QualificationEntityBlocks
            blocks={blocksBefore}
            records={entityFields.records}
            values={entityFields.values}
            onChange={entityFields.setValue}
            disabled={busy}
            isLoading={entityFields.isLoading}
            suggestions={suggestions}
            autofilled={entityFields.autofilled}
          />

          {qData ? (
            qData.questions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este questionário não tem perguntas ainda.
              </p>
            ) : (
              <div className="space-y-4">
                {qData.questions.map((q) => (
                  <QualificationQuestionInput
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

          <QualificationEntityBlocks
            blocks={blocksAfter}
            records={entityFields.records}
            values={entityFields.values}
            onChange={entityFields.setValue}
            disabled={busy}
            isLoading={entityFields.isLoading}
            suggestions={suggestions}
            autofilled={entityFields.autofilled}
          />

          <div className="border-t pt-4 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Observações (opcional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Anotações da conversa, próximos passos, etc."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Nota do lead
                </p>
                <p className="text-lg font-semibold leading-tight text-foreground">
                  {unified.total}
                  <span className="text-xs text-muted-foreground ml-1">
                    de {LEAD_SCORE_MAX} ({unified.percent}%)
                  </span>
                </p>
                <Progress
                  value={unified.percent}
                  className="h-1.5 mt-1"
                  aria-label={`Nota do lead ${unified.total} de ${LEAD_SCORE_MAX}`}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Questionário {unified.questionnairePoints}/{QUESTIONNAIRE_MAX_POINTS} · ICP{" "}
                  {unified.icpPoints}/{ICP_MAX_POINTS}
                  {unified.icpUnavailable ? " (sem critérios)" : ""}
                </p>
                <div className="mt-1 flex justify-start">
                  <LeadScoreBadge total={unified.total} />
                </div>
              </div>
              <div className="min-w-[150px]">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Questionário
                </p>
                <p
                  className={`text-sm font-semibold leading-tight ${
                    passesAuto ? "text-emerald-600" : "text-foreground"
                  }`}
                >
                  {score}
                  {maxInfo.max > 0 ? (
                    <span className="text-xs text-muted-foreground ml-1">
                      de {maxInfo.max}
                      {percent != null ? ` (${percent}%)` : ""}
                    </span>
                  ) : null}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Corte {threshold}
                  {maxInfo.hasOpenEnded ? " · há perguntas sem teto" : ""}
                </p>
              </div>
              {icpFit.data && icpFit.data.criteriaCount > 0 ? (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Fit ICP
                  </p>
                  <Badge variant={ICP_BADGE[icpFit.data.level]} className="mt-0.5">
                    {ICP_LABEL[icpFit.data.level]}
                    {icpFit.data.percent != null ? ` · ${icpFit.data.percent}%` : ""}
                  </Badge>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => saveDraft.mutate()}
              >
                Salvar rascunho
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={busy || !activeId || !!blockedReason}
                title={blockedReason}
                onClick={() => void confirmQualify()}
              >
                <Check className="w-4 h-4 mr-1" /> {qualifying ? "Qualificando..." : "Qualificar"}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={sendToNurturing}>
                <Clock className="w-4 h-4 mr-1" /> Enviar para nutrição
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => setDisqualifyOpen(true)}
              >
                <X className="w-4 h-4 mr-1" /> Desqualificar
              </Button>
            </div>
            {existingForActive?.decision && existingForActive.decision !== "pending" ? (
              <Badge variant="outline">
                Última decisão:{" "}
                <span className="ml-1 font-medium">{existingForActive.decision}</span>
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {activeId ? (
        <QualificationFieldLayoutDialog
          open={layoutOpen}
          onOpenChange={setLayoutOpen}
          questionnaireId={activeId}
          blocks={fieldLayout}
        />
      ) : null}

      {/* Desqualificar: motivo obrigatório */}
      <Dialog open={disqualifyOpen} onOpenChange={setDisqualifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desqualificar lead</DialogTitle>
            <DialogDescription>
              Informe o motivo da desqualificação. Este campo é obrigatório.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">
                Motivo <span className="text-destructive">*</span>
              </Label>
              <Select value={reasonValue} onValueChange={setReasonValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um motivo" />
                </SelectTrigger>
                <SelectContent>
                  {(lossReasons?.options ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.label}>
                      {r.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observação (opcional)</Label>
              <Textarea
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                rows={3}
                placeholder="Detalhes adicionais sobre a desqualificação"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDisqualifyOpen(false)}
              disabled={disqualifying}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDisqualify}
              disabled={!reasonValue || disqualifying}
            >
              {disqualifying ? "Desqualificando..." : "Desqualificar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
