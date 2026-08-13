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
import { Check, X, Clock, Settings2, Sparkles, RefreshCw } from "lucide-react";
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
import {
  computeQualificationScore,
  computeQualificationMaxScore,
  scorePercent,
  type ScoreQuestion,
} from "@/lib/prospecting/score";
import { getLeadIcpFit } from "@/lib/scoring/icp.functions";
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
import { useLeadStages } from "@/lib/leads/stages";

type Entity = "lead";

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
  onDecided,
}: {
  entity: Entity;
  entityId: string;
  preselectedQuestionnaireId?: string | null;
  queueId?: string | null;
  onDecided?: (decision: "qualified" | "disqualified" | "nurture") => void;
}) {
  const listQ = useServerFn(listQuestionnaires);
  const getQ = useServerFn(getQuestionnaire);
  const listExisting = useServerFn(listQualificationsForEntity);
  const save = useServerFn(saveQualification);
  const nurtureFn = useServerFn(nurtureLead);
  const listLossReasons = useServerFn(getDealLossReasons);
  const qc = useQueryClient();

  const { data: questionnaires } = useQuery({
    queryKey: ["prospecting", "questionnaires"],
    queryFn: () => listQ(),
  });

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
  const enrichment = useQuery({
    queryKey: ["qualification-enrichment", entityId, refreshKey],
    queryFn: () => enrichFn({ data: { leadId: entityId, force: refreshKey > 0 } }),
    enabled: !!entityId,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

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

  // Preenche automaticamente os campos vazios quando as sugestões chegam.
  const applySuggestions = entityFields.applySuggestions;
  useEffect(() => {
    if (!suggestions || entityFields.isLoading) return;
    applySuggestions(suggestions);
  }, [suggestions, entityFields.isLoading, applySuggestions]);

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

  const { stages } = useLeadStages();
  const qualifiedStage = useMemo(
    () => stages.find((s) => s.value === "qualified") ?? stages.find((s) => s.type === "won"),
    [stages],
  );

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
      // 2) registra a qualificação (respostas + score + observações)
      await save({
        data: {
          id: existingForActive?.id,
          questionnaire_id: activeId,
          entity,
          entity_id: entityId,
          answers,
          decision: "qualified",
          decision_reason: reason || null,
        },
      });
      // 3) move o lead para a etapa de qualificado do funil
      const patch: Record<string, unknown> = { status: "qualified" };
      if (qualifiedStage) patch.stage_id = qualifiedStage.value;
      const { error: leadErr } = await supabase
        .from("leads")
        .update(patch as never)
        .eq("id", entityId);
      if (leadErr) throw new Error(leadErr.message);

      toast.success("Lead qualificado.");
      qc.invalidateQueries({
        queryKey: ["prospecting", "qualifications", entity, entityId],
      });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead", entityId] });
      qc.invalidateQueries({ queryKey: ["qualification-entity-records", entityId] });
      onDecided?.("qualified");
    } catch (e) {
      toast.error((e as Error).message);
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
      // 1) atualiza status do lead
      const { error: leadErr } = await supabase
        .from("leads")
        .update({ status: "disqualified" })
        .eq("id", entityId);
      if (leadErr) throw new Error(leadErr.message);
      // 2) grava a qualificação com decision + motivo (obrigatório)
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
          },
        });
      }
      toast.success("Lead desqualificado.");
      qc.invalidateQueries({
        queryKey: ["prospecting", "qualifications", entity, entityId],
      });
      qc.invalidateQueries({ queryKey: ["leads"] });
      setDisqualifyOpen(false);
      setReasonValue("");
      setReasonNote("");
      onDecided?.("disqualified");
    } catch (e) {
      toast.error((e as Error).message);
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
        },
      });
      if (res.enrolled && res.cadence_name) {
        toast.success(`Lead enviado para nutrição — cadência: ${res.cadence_name}.`);
      } else {
        toast.success("Lead enviado para nutrição.");
      }
      qc.invalidateQueries({
        queryKey: ["prospecting", "qualifications", entity, entityId],
      });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["prospecting", "queue-items"] });
      qc.invalidateQueries({ queryKey: ["prospecting", "queue-count"] });
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
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Nenhum questionário ativo. Crie um em <strong>Prospecção → Questionários</strong>.
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
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Qualificação</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Preencha as respostas e defina a decisão final.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right min-w-[168px]">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Score</p>
              <p
                className={`text-lg font-semibold leading-tight ${
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
              {maxInfo.max > 0 ? (
                <Progress
                  value={percent ?? 0}
                  className="h-1.5 mt-1"
                  aria-label={`Score ${score} de ${maxInfo.max}`}
                />
              ) : null}
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Corte {threshold}
                {maxInfo.hasOpenEnded ? " · há perguntas sem teto" : ""}
              </p>
            </div>
            {icpFit.data && icpFit.data.criteriaCount > 0 ? (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Fit ICP
                </p>
                <Badge variant={ICP_BADGE[icpFit.data.level]} className="mt-0.5">
                  {ICP_LABEL[icpFit.data.level]}
                  {icpFit.data.percent != null ? ` · ${icpFit.data.percent}%` : ""}
                </Badge>
              </div>
            ) : null}
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
              <Badge
                variant="secondary"
                className="gap-1"
                title={enrichment.data.domain ? `Domínio: ${enrichment.data.domain}` : undefined}
              >
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                Apollo {enrichment.data.domain ? `· ${enrichment.data.domain}` : ""}
              </Badge>
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
