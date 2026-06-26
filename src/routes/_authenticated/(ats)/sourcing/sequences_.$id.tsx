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
} from "@/lib/ats/sourcing-sequences.functions";
import { AtsPageHeader, AtsSectionHeader, EmptyState, Skeletons } from "@/components/ats/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  wait: Clock,
} as const;

function SequenceDetailPage() {
  const { id } = useParams({ from: "/_authenticated/(ats)/sourcing/sequences_/$id" });
  const qc = useQueryClient();
  const fetcher = useServerFn(getSequence);
  const upsert = useServerFn(upsertStep);
  const del = useServerFn(deleteStep);

  const { data, isLoading } = useQuery({
    queryKey: ["ats-sequence", id],
    queryFn: () => fetcher({ data: { id } }),
  });

  const [draft, setDraft] = useState({
    channel: "email" as "email" | "whatsapp" | "linkedin_task" | "wait",
    delay_days: 0,
    subject: "",
    body: "",
    task_instructions: "",
  });

  const addStep = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          sequence_id: id,
          step_order: (data?.steps.length ?? 0) + 1,
          channel: draft.channel,
          delay_days: draft.delay_days,
          subject: draft.subject.trim() || null,
          body: draft.body.trim() || null,
          task_instructions: draft.task_instructions.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Step adicionado");
      setDraft({ channel: "email", delay_days: 0, subject: "", body: "", task_instructions: "" });
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
                        <p className="text-sm font-medium">
                          Step {s.step_order} · {s.channel}
                          {s.delay_days ? ` · +${s.delay_days}d` : ""}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {s.subject || s.task_instructions || s.body || "—"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeStep.mutate(s.id)}
                    >
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
        <AtsSectionHeader title="Adicionar step" />
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Canal</Label>
                <Select
                  value={draft.channel}
                  onValueChange={(v) => setDraft({ ...draft, channel: v as typeof draft.channel })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp (tarefa)</SelectItem>
                    <SelectItem value="linkedin_task">LinkedIn (tarefa)</SelectItem>
                    <SelectItem value="wait">Espera</SelectItem>
                  </SelectContent>
                </Select>
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
            </div>
            {draft.channel === "email" ? (
              <>
                <div className="space-y-1.5">
                  <Label>Assunto</Label>
                  <Input
                    value={draft.subject}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Corpo</Label>
                  <Textarea
                    rows={4}
                    value={draft.body}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  />
                </div>
              </>
            ) : draft.channel === "wait" ? null : (
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
