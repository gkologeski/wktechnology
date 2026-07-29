/**
 * Painel de qualificação — renderiza um questionário ativo para um lead,
 * calcula score em tempo real e permite decisão manual final do SDR:
 * qualificar (abre criação de negócio), desqualificar (motivo obrigatório)
 * ou enviar para nutrição.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, X, Clock } from "lucide-react";
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
import { CreateDealFromLeadDialog } from "@/components/leads/create-deal-from-lead-dialog";
import type { Lead } from "@/lib/db-types";
import { listQuestionnaires, getQuestionnaire } from "@/lib/prospecting/questionnaires.functions";
import {
  saveQualification,
  listQualificationsForEntity,
  nurtureLead,
} from "@/lib/prospecting/qualifications.functions";
import { getDealLossReasons } from "@/lib/deal-loss-reasons.functions";

type Entity = "lead";

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

  const existingForActive = existing?.find(
    (e) => e.questionnaire_id === activeId,
  );

  const [answers, setAnswers] = useState<Record<string, unknown>>(
    (existingForActive?.answers as Record<string, unknown>) ?? {},
  );
  const [reason, setReason] = useState("");

  // Sincroniza respostas quando o registro existente carrega ou muda de questionário.
  useEffect(() => {
    setAnswers((existingForActive?.answers as Record<string, unknown>) ?? {});
    setReason("");
  }, [existingForActive?.id, activeId]);

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

  const qualificationSummary = useMemo(() => {
    if (!qData) return "";
    const lines: string[] = [];
    lines.push(
      `Qualificação — ${qData.questionnaire.name} (score ${score}/${threshold})`,
    );
    lines.push("");
    for (const q of qData.questions) {
      const raw = answers[q.id];
      if (raw == null || raw === "" || (Array.isArray(raw) && raw.length === 0)) continue;
      let formatted: string;
      if (q.type === "boolean") formatted = raw === true ? "Sim" : "Não";
      else if (q.type === "multi" && Array.isArray(raw)) formatted = raw.join(", ");
      else formatted = String(raw);
      lines.push(`- ${q.label}: ${formatted}`);
    }
    return lines.join("\n");
  }, [qData, answers, score, threshold]);

  const saveDraft = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: existingForActive?.id,
          questionnaire_id: activeId!,
          entity,
          entity_id: entityId,
          answers,
        },
      }),
    onSuccess: () => {
      toast.success("Qualificação salva.");
      qc.invalidateQueries({
        queryKey: ["prospecting", "qualifications", entity, entityId],
      });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // ---------- Qualificar → abre CreateDealFromLeadDialog ----------
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [leadRecord, setLeadRecord] = useState<Lead | null>(null);
  const [loadingLead, setLoadingLead] = useState(false);

  async function openQualifyDialog() {
    setLoadingLead(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", entityId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Lead não encontrado.");
      setLeadRecord(data as unknown as Lead);
      setDealDialogOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingLead(false);
    }
  }

  async function onDealCreated() {
    // Registra a qualificação (score + respostas) atrelada ao questionário ativo
    if (activeId) {
      try {
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
      } catch (e) {
        // não bloqueia — o negócio já foi criado
        console.warn("saveQualification failed", e);
      }
    }
    qc.invalidateQueries({
      queryKey: ["prospecting", "qualifications", entity, entityId],
    });
    qc.invalidateQueries({ queryKey: ["leads"] });
    onDecided?.("qualified");
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
      const combined = reasonNote.trim()
        ? `${reasonValue} — ${reasonNote.trim()}`
        : reasonValue;
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

  const busy =
    saveDraft.isPending || loadingLead || disqualifying || nurturing;

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
                disabled={busy}
                onClick={openQualifyDialog}
              >
                <Check className="w-4 h-4 mr-1" /> Qualificar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={sendToNurturing}
              >
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

      {/* Qualificar: modal padrão do CRM que cria negócio a partir do lead */}
      {leadRecord ? (
        <CreateDealFromLeadDialog
          open={dealDialogOpen}
          onOpenChange={(v) => {
            setDealDialogOpen(v);
            if (!v) setLeadRecord(null);
          }}
          lead={leadRecord}
          onCreated={() => {
            void onDealCreated();
          }}
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
