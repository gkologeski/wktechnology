// Detalhe de sequência: steps editáveis e enrollments.
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Trash2, Mail, MessageSquare, Linkedin, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  getSequence,
  upsertStep,
  deleteStep,
  updateSequence,
} from "@/lib/ats/sourcing-sequences.functions";
import { AtsPageHeader, AtsSectionHeader, EmptyState, Skeletons } from "@/components/ats/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TokenPills } from "@/components/ui/token-pills";
import { ATS_SOURCING_TOKENS, LINKEDIN_TOKENS } from "@/lib/message-tokens-catalog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/(ats)/sourcing/sequences_/$id")({
  component: SequenceDetailPage,
});

const CHANNEL_ICON = {
  email: Mail,
  whatsapp: MessageSquare,
  linkedin_task: Linkedin,
  linkedin_invite: Linkedin,
  linkedin_message: Linkedin,
  wait: Clock,
  wait_invite_accept: Clock,
} as const;

type Channel =
  | "email"
  | "whatsapp"
  | "linkedin_task"
  | "linkedin_invite"
  | "linkedin_message"
  | "wait"
  | "wait_invite_accept";

function SequenceDetailPage() {
  const { id } = useParams({ from: "/_authenticated/(ats)/sourcing/sequences_/$id" });
  const qc = useQueryClient();
  const fetcher = useServerFn(getSequence);
  const upsert = useServerFn(upsertStep);
  const del = useServerFn(deleteStep);
  const update = useServerFn(updateSequence);

  const { data, isLoading } = useQuery({
    queryKey: ["ats-sequence", id],
    queryFn: () => fetcher({ data: { id } }),
  });

  const [draft, setDraft] = useState({
    step_order: 0, // 0 = novo step (auto), >0 = variante de step existente
    variant_label: "A",
    variant_weight: 1,
    channel: "email" as Channel,
    delay_days: 0,
    subject: "",
    body: "",
    task_instructions: "",
    max_wait_days: 14,
    poll_interval_hours: 12,
    on_timeout: "end_sequence" as "skip_messages" | "end_sequence" | "continue",
  });

  const maxStepOrder = data?.steps.reduce((m, s) => Math.max(m, s.step_order), 0) ?? 0;
  const targetStepOrder = draft.step_order > 0 ? draft.step_order : maxStepOrder + 1;

  const addStep = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          sequence_id: id,
          step_order: targetStepOrder,
          channel: draft.channel,
          delay_days: draft.delay_days,
          subject: draft.subject.trim() || null,
          body: draft.body.trim() || null,
          task_instructions: draft.task_instructions.trim() || null,
          variant_label: draft.variant_label.trim().toUpperCase().slice(0, 8) || "A",
          variant_weight: draft.variant_weight,
          max_wait_days: draft.channel === "wait_invite_accept" ? draft.max_wait_days : null,
          poll_interval_hours:
            draft.channel === "wait_invite_accept" ? draft.poll_interval_hours : null,
          on_timeout: draft.channel === "wait_invite_accept" ? draft.on_timeout : null,
        },
      }),
    onSuccess: () => {
      toast.success("Step adicionado");
      setDraft({
        step_order: 0,
        variant_label: "A",
        variant_weight: 1,
        channel: "email",
        delay_days: 0,
        subject: "",
        body: "",
        task_instructions: "",
        max_wait_days: 14,
        poll_interval_hours: 12,
        on_timeout: "end_sequence",
      });
      qc.invalidateQueries({ queryKey: ["ats-sequence", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeStep = useMutation({
    mutationFn: (stepId: string) => del({ data: { id: stepId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ats-sequence", id] }),
  });

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-6 pb-10">
        <Skeletons.Row />
        <Skeletons.Card />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AtsPageHeader
        eyebrow="ATS · Sequência"
        title={data.sequence.name}
        description={data.sequence.description ?? "Cadência multi-canal."}
      />

      <SequenceSettings
        sequence={data.sequence as never}
        onSave={async (patch) => {
          await update({ data: { id, ...patch } });
          toast.success("Configurações salvas");
          qc.invalidateQueries({ queryKey: ["ats-sequence", id] });
        }}
      />

      <section className="space-y-3">
        <AtsSectionHeader title="Steps" description="Ordem de execução da cadência." />
        {data.steps.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="Sem steps ainda"
            description="Adicione o primeiro contato abaixo."
          />
        ) : (
          <div className="space-y-2">
            {data.steps.map((s) => {
              const Icon = CHANNEL_ICON[s.channel as keyof typeof CHANNEL_ICON] ?? Mail;
              return (
                <Card key={s.id}>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <span>
                            Step {s.step_order} · {s.channel}
                            {s.delay_days ? ` · +${s.delay_days}d` : ""}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            Variante {(s as { variant_label?: string }).variant_label ?? "A"}
                            {((s as { variant_weight?: number }).variant_weight ?? 1) > 1
                              ? ` · peso ${(s as { variant_weight?: number }).variant_weight}`
                              : ""}
                          </Badge>
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {s.subject || s.task_instructions || s.body || "—"}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeStep.mutate(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <AtsSectionHeader
          title="Adicionar step ou variante (A/B)"
          description="Mesma posição (step) com variant_label diferente cria uma variante A/B sorteada por peso."
        />
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Posição</Label>
                <Select
                  value={String(draft.step_order)}
                  onValueChange={(v) => setDraft({ ...draft, step_order: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Novo step (#{maxStepOrder + 1})</SelectItem>
                    {Array.from({ length: maxStepOrder }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        Variante do step {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Variante</Label>
                <Input
                  maxLength={8}
                  value={draft.variant_label}
                  onChange={(e) => setDraft({ ...draft, variant_label: e.target.value })}
                  placeholder="A, B, C..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Peso</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={draft.variant_weight}
                  onChange={(e) =>
                    setDraft({ ...draft, variant_weight: Number(e.target.value) || 1 })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Canal</Label>
                <Select
                  value={draft.channel}
                  onValueChange={(v) => setDraft({ ...draft, channel: v as typeof draft.channel })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp (tarefa)</SelectItem>
                    <SelectItem value="linkedin_invite">LinkedIn — Convite (Unipile)</SelectItem>
                    <SelectItem value="linkedin_message">LinkedIn — Mensagem (Unipile)</SelectItem>
                    <SelectItem value="linkedin_task">LinkedIn (tarefa manual)</SelectItem>
                    <SelectItem value="wait">Espera (dias fixos)</SelectItem>
                    <SelectItem value="wait_invite_accept">Aguardar aceite do convite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Atraso (dias)</Label>
              <Input
                type="number"
                min={0}
                value={draft.delay_days}
                onChange={(e) => setDraft({ ...draft, delay_days: Number(e.target.value) || 0 })}
              />
            </div>
            {draft.channel === "email" ? (
              <>
                <div className="space-y-1.5">
                  <Label>Assunto</Label>
                  <Input
                    value={draft.subject}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  />
                  <TokenPills
                    className="mt-1.5"
                    tokens={ATS_SOURCING_TOKENS}
                    onInsert={(t) => setDraft((d) => ({ ...d, subject: (d.subject ?? "") + t }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Corpo</Label>
                  <Textarea
                    rows={4}
                    value={draft.body}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  />
                  <TokenPills
                    className="mt-1.5"
                    tokens={ATS_SOURCING_TOKENS}
                    onInsert={(t) => setDraft((d) => ({ ...d, body: (d.body ?? "") + t }))}
                  />
                </div>
              </>
            ) : draft.channel === "wait" ? null : draft.channel === "wait_invite_accept" ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Janela máxima (dias)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={draft.max_wait_days}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        max_wait_days: Math.min(30, Math.max(1, Number(e.target.value) || 1)),
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Checar a cada (horas)</Label>
                  <Input
                    type="number"
                    min={6}
                    max={48}
                    value={draft.poll_interval_hours}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        poll_interval_hours: Math.min(48, Math.max(6, Number(e.target.value) || 6)),
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Se não aceitar</Label>
                  <Select
                    value={draft.on_timeout}
                    onValueChange={(v) =>
                      setDraft({ ...draft, on_timeout: v as typeof draft.on_timeout })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="end_sequence">Encerrar sequência</SelectItem>
                      <SelectItem value="skip_messages">Pular mensagens LinkedIn</SelectItem>
                      <SelectItem value="continue">Continuar mesmo assim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="sm:col-span-3 text-xs text-muted-foreground">
                  Só pode ser adicionado depois de um step de LinkedIn — Convite. Respeita o rate
                  limit do Unipile e não consome sua cota diária de envios.
                </p>
              </div>
            ) : draft.channel === "linkedin_invite" || draft.channel === "linkedin_message" ? (
              <div className="space-y-1.5">
                <Label>
                  {draft.channel === "linkedin_invite"
                    ? "Mensagem do convite (máx. 300 caracteres)"
                    : "Mensagem do LinkedIn"}
                </Label>
                <Textarea
                  rows={4}
                  maxLength={draft.channel === "linkedin_invite" ? 300 : 8000}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  placeholder="Olá {{first_name}}, ..."
                />
                <TokenPills
                  className="mt-1.5"
                  tokens={LINKEDIN_TOKENS}
                  onInsert={(t) => setDraft((d) => ({ ...d, body: (d.body ?? "") + t }))}
                />
                <p className="text-xs text-muted-foreground">
                  Enviado automaticamente via Unipile. Requer LinkedIn conectado em Configurações →
                  Integrações.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Instruções para o recrutador</Label>
                <Textarea
                  rows={4}
                  value={draft.task_instructions}
                  onChange={(e) => setDraft({ ...draft, task_instructions: e.target.value })}
                />
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => addStep.mutate()} disabled={addStep.isPending}>
                <Plus className="mr-1 h-4 w-4" />
                {addStep.isPending ? "Adicionando..." : "Adicionar step"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <AtsSectionHeader
          title="Inscrições"
          description={`${data.enrollments.length} candidato(s) nesta sequência.`}
        />
        {data.enrollments.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="Sem inscrições"
            description="Adicione candidatos pela aba do candidato ou a partir de um pool."
          />
        ) : (
          <div className="space-y-2">
            {data.enrollments.map((e) => (
              <Card key={e.id}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {(e.candidate as { full_name?: string } | null)?.full_name ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      Step {e.current_step} ·{" "}
                      {e.next_run_at
                        ? `próximo em ${new Date(e.next_run_at).toLocaleString("pt-BR")}`
                        : "concluído"}
                    </p>
                  </div>
                  <Badge variant={e.status === "active" ? "default" : "secondary"}>
                    {e.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type SequenceLike = {
  timezone?: string | null;
  quiet_hours_start?: number | null;
  quiet_hours_end?: number | null;
  daily_send_limit?: number | null;
  send_days?: number[] | null;
};

type SequenceSettingsPatch = {
  timezone?: string;
  quiet_hours_start?: number | null;
  quiet_hours_end?: number | null;
  daily_send_limit?: number | null;
  send_days?: number[];
};

const WEEKDAYS = [
  { v: 0, l: "Dom" },
  { v: 1, l: "Seg" },
  { v: 2, l: "Ter" },
  { v: 3, l: "Qua" },
  { v: 4, l: "Qui" },
  { v: 5, l: "Sex" },
  { v: 6, l: "Sáb" },
];

function SequenceSettings({
  sequence,
  onSave,
}: {
  sequence: SequenceLike;
  onSave: (patch: SequenceSettingsPatch) => Promise<void>;
}) {
  const [tz, setTz] = useState(sequence.timezone ?? "America/Sao_Paulo");
  const [qStart, setQStart] = useState<string>(
    sequence.quiet_hours_start == null ? "" : String(sequence.quiet_hours_start),
  );
  const [qEnd, setQEnd] = useState<string>(
    sequence.quiet_hours_end == null ? "" : String(sequence.quiet_hours_end),
  );
  const [limit, setLimit] = useState<string>(
    sequence.daily_send_limit == null ? "" : String(sequence.daily_send_limit),
  );
  const [days, setDays] = useState<number[]>(sequence.send_days ?? [1, 2, 3, 4, 5]);
  const [saving, setSaving] = useState(false);

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        timezone: tz,
        quiet_hours_start: qStart === "" ? null : Number(qStart),
        quiet_hours_end: qEnd === "" ? null : Number(qEnd),
        daily_send_limit: limit === "" ? null : Number(limit),
        send_days: days,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-3">
      <AtsSectionHeader
        title="Throttling & quiet hours"
        description="Controle o ritmo de envio para proteger reputação de domínio."
      />
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Fuso horário</Label>
              <Input
                value={tz}
                onChange={(e) => setTz(e.target.value)}
                placeholder="America/Sao_Paulo"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Limite diário</Label>
              <Input
                type="number"
                min={0}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="ilimitado"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Quiet hours (hora 0–23)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={qStart}
                  onChange={(e) => setQStart(e.target.value)}
                  placeholder="início"
                />
                <span className="text-xs text-muted-foreground">→</span>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={qEnd}
                  onChange={(e) => setQEnd(e.target.value)}
                  placeholder="fim"
                />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Dias de envio</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => {
                const on = days.includes(d.v);
                return (
                  <button
                    key={d.v}
                    type="button"
                    onClick={() => toggleDay(d.v)}
                    className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {d.l}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar configurações"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
