// Sourcing Inbox — Onda 5 / Slice 2 / Fase 3.
// Caixa unificada de triagem das sequências em andamento.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Inbox as InboxIcon,
  AlertTriangle,
  CheckCircle2,
  Mail,
  MessageSquare,
  Linkedin,
  Play,
  Pause,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import { AtsPageHeader, EmptyState, Skeletons } from "@/components/ats/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  listInbox,
  markStepHandled,
  resumeEnrollment,
  markCandidateReplied,
} from "@/lib/ats/sourcing-inbox.functions";
import { stopEnrollment } from "@/lib/ats/sourcing-sequences.functions";

export const Route = createFileRoute("/_authenticated/(ats)/sourcing/inbox")({
  component: InboxPage,
});

const CHANNEL_ICON: Record<string, typeof Mail> = {
  email: Mail,
  whatsapp: MessageSquare,
  linkedin_task: Linkedin,
  wait: Mail,
};

function ChannelBadge({ channel }: { channel: string }) {
  const Icon = CHANNEL_ICON[channel] ?? Mail;
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <Icon className="h-3 w-3" />
      {channel}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Ativo", cls: "bg-primary/10 text-primary border-primary/20" },
    paused: { label: "Pausado", cls: "bg-muted text-muted-foreground" },
    replied: {
      label: "Respondeu",
      cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    },
    stopped: { label: "Encerrado", cls: "bg-muted text-muted-foreground" },
    completed: { label: "Concluído", cls: "bg-muted text-muted-foreground" },
  };
  const m = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <Badge variant="outline" className={`font-normal ${m.cls}`}>
      {m.label}
    </Badge>
  );
}

function CandidateLine({
  candidate,
  sequenceName,
}: {
  candidate: { id: string; full_name: string | null; email: string | null } | null;
  sequenceName: string | undefined;
}) {
  if (!candidate) return <span className="text-sm text-muted-foreground">Candidato removido</span>;
  return (
    <div className="min-w-0 space-y-0.5">
      <div className="flex items-center gap-2">
        <Link
          to="/candidates/$id"
          params={{ id: candidate.id }}
          className="truncate text-sm font-medium hover:underline"
        >
          {candidate.full_name ?? "Sem nome"}
        </Link>
        <ExternalLink className="h-3 w-3 text-muted-foreground" />
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {candidate.email ?? "sem email"} · {sequenceName ?? "Sequência"}
      </p>
    </div>
  );
}

function InboxPage() {
  const qc = useQueryClient();
  const fetchInbox = useServerFn(listInbox);
  const markHandled = useServerFn(markStepHandled);
  const resume = useServerFn(resumeEnrollment);
  const stop = useServerFn(stopEnrollment);
  const markReplied = useServerFn(markCandidateReplied);
  const [tab, setTab] = useState<"tasks" | "failures" | "review">("tasks");

  const { data, isLoading } = useQuery({
    queryKey: ["ats-sourcing-inbox"],
    queryFn: () => fetchInbox(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["ats-sourcing-inbox"] });

  const handleMut = useMutation({
    mutationFn: (log_id: string) => markHandled({ data: { log_id } }),
    onSuccess: () => {
      toast.success("Tarefa marcada como concluída");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resumeMut = useMutation({
    mutationFn: (enrollment_id: string) => resume({ data: { enrollment_id } }),
    onSuccess: () => {
      toast.success("Sequência retomada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stopMut = useMutation({
    mutationFn: (enrollment_id: string) => stop({ data: { enrollment_id, reason: "stopped" } }),
    onSuccess: () => {
      toast.success("Sequência encerrada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const repliedMut = useMutation({
    mutationFn: (vars: {
      enrollment_id: string;
      channel: "whatsapp" | "linkedin_task" | "email" | "inbound";
    }) => markReplied({ data: vars }),
    onSuccess: () => {
      toast.success("Candidato marcado como respondeu");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = data?.counts ?? { tasks: 0, failures: 0, review: 0 };
  const total = useMemo(() => counts.tasks + counts.failures + counts.review, [counts]);

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AtsPageHeader
        eyebrow="ATS · Sourcing"
        title="Inbox de Sourcing"
        description="Triagem unificada das suas sequências: tarefas manuais, falhas e respostas que precisam de decisão."
      />

      {isLoading ? (
        <div className="space-y-2">
          <Skeletons.Card />
          <Skeletons.Card />
          <Skeletons.Card />
        </div>
      ) : total === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="Inbox vazia"
          description="Quando suas sequências tiverem tarefas pendentes, falhas ou respostas, elas aparecerão aqui."
        />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
          <TabsList>
            <TabsTrigger value="tasks">
              Tarefas manuais
              {counts.tasks > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {counts.tasks}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="failures">
              Falhas
              {counts.failures > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {counts.failures}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="review">
              Aguardando decisão
              {counts.review > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {counts.review}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-4 space-y-2">
            {data?.pendingTasks.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Nenhuma tarefa pendente"
                description="Todas as tarefas manuais das suas sequências foram processadas."
              />
            ) : (
              data?.pendingTasks.map((item) =>
                item ? (
                  <Card key={item.log.id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <ChannelBadge channel={item.log.channel} />
                        <CandidateLine
                          candidate={item.candidate}
                          sequenceName={item.sequence?.name}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        Step {item.log.step_order} ·{" "}
                        {new Date(item.log.created_at).toLocaleString("pt-BR")}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => stopMut.mutate(item.enrollment.id)}
                        >
                          <Pause className="mr-1 h-3.5 w-3.5" />
                          Pausar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            repliedMut.mutate({
                              enrollment_id: item.enrollment.id,
                              channel:
                                item.log.channel === "whatsapp"
                                  ? "whatsapp"
                                  : item.log.channel === "linkedin_task"
                                    ? "linkedin_task"
                                    : "inbound",
                            })
                          }
                          disabled={repliedMut.isPending}
                        >
                          <MessageSquare className="mr-1 h-3.5 w-3.5" />
                          Respondeu
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleMut.mutate(item.log.id)}
                          disabled={handleMut.isPending}
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          Concluí
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null,
              )
            )}
          </TabsContent>

          <TabsContent value="failures" className="mt-4 space-y-2">
            {data?.failures.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Sem falhas"
                description="Nenhum step falhou recentemente."
              />
            ) : (
              data?.failures.map((item) =>
                item ? (
                  <Card key={item.log.id} className="border-destructive/30">
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                        <ChannelBadge channel={item.log.channel} />
                        <CandidateLine
                          candidate={item.candidate}
                          sequenceName={item.sequence?.name}
                        />
                      </div>
                      <div className="min-w-0 text-xs text-destructive">
                        {item.log.error ?? "Erro desconhecido"}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resumeMut.mutate(item.enrollment.id)}
                        >
                          <Play className="mr-1 h-3.5 w-3.5" />
                          Retomar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => stopMut.mutate(item.enrollment.id)}
                        >
                          Encerrar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null,
              )
            )}
          </TabsContent>

          <TabsContent value="review" className="mt-4 space-y-2">
            {data?.needsReview.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Nada para revisar"
                description="Nenhum enrollment aguardando decisão humana."
              />
            ) : (
              data?.needsReview.map((item) => (
                <Card key={item.enrollment.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <StatusBadge status={item.enrollment.status} />
                      <CandidateLine
                        candidate={item.candidate}
                        sequenceName={item.sequence?.name}
                      />
                    </div>
                    {item.enrollment.last_error && (
                      <div className="min-w-0 text-xs text-destructive">
                        {item.enrollment.last_error}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resumeMut.mutate(item.enrollment.id)}
                      >
                        <Play className="mr-1 h-3.5 w-3.5" />
                        Retomar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => stopMut.mutate(item.enrollment.id)}
                      >
                        Encerrar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
