import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  SkipForward,
  ArrowRight,
  Phone,
  Mail,
  Play,
  ListChecks,
  ShieldOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActivityTimeline } from "@/components/activity-timeline";
import { QualificationPanel } from "@/components/prospecting/qualification-panel";
import { listQueues, listQueueItems } from "@/lib/prospecting/queues.functions";
import { listQuestionnaires } from "@/lib/prospecting/questionnaires.functions";
import { usePermissions } from "@/lib/access-control/use-permissions";

export const Route = createFileRoute("/_authenticated/prospecting/queues/$queueId/play")({
  component: PlayProspectingQueueGuarded,
});

function PlayProspectingQueueGuarded() {
  const { can, isLoading } = usePermissions();
  if (isLoading) return null;
  if (!can("techsales.prospecting.queue.view")) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <ShieldOff className="h-8 w-8 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">Sem acesso à Fila de prospecção</p>
              <p className="text-sm text-muted-foreground max-w-md">
                Você não tem permissão para executar filas de prospecção. Solicite ao administrador
                em Configurações → Controle de acesso → Permissões.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/prospecting">Voltar</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  return <PlayProspectingQueue />;
}

const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "Novo",
  working: "Em trabalho",
  contacted: "Contatado",
  qualified: "Qualificado",
  unqualified: "Desqualificado",
  converted: "Convertido",
  lost: "Perdido",
  nurturing: "Em nutrição",
};

const CONTACT_LIFECYCLE_LABELS: Record<string, string> = {
  subscriber: "Assinante",
  lead: "Lead",
  mql: "MQL",
  sql: "SQL",
  opportunity: "Oportunidade",
  customer: "Cliente",
  evangelist: "Evangelista",
  other: "Outro",
};

function statusLabel(entity: string, raw: string): string {
  const map = entity === "lead" ? LEAD_STATUS_LABELS : CONTACT_LIFECYCLE_LABELS;
  const key = raw?.toLowerCase?.() ?? "";
  return map[key] ?? (raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : raw);
}

function PlayProspectingQueue() {
  const { queueId } = Route.useParams();
  const nav = useNavigate();

  const listQueuesFn = useServerFn(listQueues);
  const listItemsFn = useServerFn(listQueueItems);
  const listQFn = useServerFn(listQuestionnaires);

  const queuesQ = useQuery({
    queryKey: ["prospecting", "queues"],
    queryFn: () => listQueuesFn(),
  });
  const itemsQ = useQuery({
    queryKey: ["prospecting", "queue-items", queueId, "play"],
    queryFn: () => listItemsFn({ data: { queue_id: queueId, limit: 200, offset: 0 } }),
  });
  const questionnairesQ = useQuery({
    queryKey: ["prospecting", "questionnaires"],
    queryFn: () => listQFn(),
  });

  const [questionnaireId, setQuestionnaireId] = useState<string | null>(null);
  const [pendingQuestionnaireId, setPendingQuestionnaireId] = useState<string>("");
  const [idx, setIdx] = useState(0);

  const queue = queuesQ.data?.find((q) => q.id === queueId);
  // Filas podem ser de leads ou de contatos — respeita a entidade da fila.
  const entity: "lead" | "contact" =
    queue?.entity === "contact" || itemsQ.data?.entity === "contact" ? "contact" : "lead";
  const items = (itemsQ.data?.items ?? []) as unknown as Array<Record<string, unknown>>;
  const total = items.length;
  const current = items[idx];

  const enabledQuestionnaires = (questionnairesQ.data ?? []).filter((q) => q.enabled);

  useEffect(() => {
    if (!pendingQuestionnaireId && enabledQuestionnaires[0]?.id) {
      setPendingQuestionnaireId(enabledQuestionnaires[0].id);
    }
  }, [enabledQuestionnaires, pendingQuestionnaireId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!questionnaireId || !current) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "s" || e.key === "S") setIdx((i) => Math.min(i + 1, total));
      if (e.key === "n" || e.key === "N" || e.key === "ArrowRight")
        setIdx((i) => Math.min(i + 1, total));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [questionnaireId, current, total]);

  if (itemsQ.isLoading || queuesQ.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  const headerBack = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => nav({ to: "/prospecting", search: { tab: "fila" as const } })}
    >
      <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
    </Button>
  );

  // Estado A — escolha de questionário
  if (!questionnaireId) {
    return (
      <div className="mx-auto max-w-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          {headerBack}
          <div className="text-sm text-muted-foreground">
            <ListChecks className="mr-1 inline h-4 w-4" />
            {queue?.name ?? "Fila"} · {total} {entity === "lead" ? "leads" : "contatos"}
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Escolha um questionário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {enabledQuestionnaires.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Nenhum questionário ativo. Crie um em{" "}
                <Link
                  to="/prospecting"
                  search={{ tab: "questionarios" as const }}
                  className="underline"
                >
                  Prospecção → Questionários
                </Link>
                .
              </div>
            ) : (
              <>
                <Select value={pendingQuestionnaireId} onValueChange={setPendingQuestionnaireId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar questionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledQuestionnaires.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex justify-end">
                  <Button
                    disabled={!pendingQuestionnaireId || total === 0}
                    onClick={() => {
                      setQuestionnaireId(pendingQuestionnaireId);
                      setIdx(0);
                    }}
                  >
                    <Play className="mr-1 h-4 w-4" /> Começar
                  </Button>
                </div>
                {total === 0 ? (
                  <p className="text-xs text-muted-foreground">Esta fila não possui itens.</p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Estado B — workspace por item
  if (!current) {
    return (
      <div className="mx-auto max-w-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          {headerBack}
          <div className="text-sm text-muted-foreground">
            <ListChecks className="mr-1 inline h-4 w-4" />
            {queue?.name ?? "Fila"}
          </div>
        </div>
        <Card>
          <CardContent className="pt-8 text-center space-y-2">
            <p className="text-lg font-medium">Fila concluída 🎉</p>
            <p className="text-sm text-muted-foreground">Todos os itens foram trabalhados.</p>
            <Button asChild variant="outline">
              <Link to="/prospecting" search={{ tab: "fila" as const }}>
                Voltar para filas
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const id = String(current.id);
  const firstName = (current.first_name as string | null) ?? "";
  const lastName = (current.last_name as string | null) ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  const email = current.email ? String(current.email) : "";
  const phone = current.phone ? String(current.phone) : "";
  const companyName =
    (current.company_name as string | null) ??
    (current.company as { name?: string } | null)?.name ??
    null;
  const statusRaw =
    entity === "lead"
      ? current.status
        ? String(current.status)
        : null
      : current.lifecycle_stage
        ? String(current.lifecycle_stage)
        : null;
  const score = typeof current.score === "number" ? current.score : null;
  const detailTo = entity === "lead" ? "/leads/$id" : "/contacts/$id";
  const relatedKey = entity === "lead" ? "related_lead_id" : "related_contact_id";
  const displayName = fullName || email || companyName || (entity === "lead" ? "Lead" : "Contato");

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        {headerBack}
        <div className="text-sm text-muted-foreground">
          <ListChecks className="mr-1 inline h-4 w-4" />
          {queue?.name ?? "Fila"} · Item {idx + 1} de {total}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                <Link to={detailTo} params={{ id }} className="hover:underline">
                  {displayName}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-1">
                {statusRaw ? (
                  <Badge variant="outline" className="text-[10px]">
                    {statusLabel(entity, statusRaw)}
                  </Badge>
                ) : null}
                {score != null ? (
                  <Badge variant="secondary" className="text-[10px]">
                    score {score}
                  </Badge>
                ) : null}
              </div>
              {email ? (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    E-mail
                  </p>
                  <p className="truncate">{email}</p>
                </div>
              ) : null}
              {phone ? (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Telefone
                  </p>
                  <p>{phone}</p>
                </div>
              ) : null}
              {companyName ? (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Empresa
                  </p>
                  <p className="truncate">{companyName}</p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-2">
                {phone ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={`tel:${phone}`}>
                      <Phone className="mr-1 h-4 w-4" /> Ligar
                    </a>
                  </Button>
                ) : null}
                {email ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={`mailto:${email}`}>
                      <Mail className="mr-1 h-4 w-4" /> E-mail
                    </a>
                  </Button>
                ) : null}
                <Button asChild variant="outline" size="sm">
                  <Link to={detailTo} params={{ id }}>
                    Abrir registro
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={() => setIdx((i) => Math.min(i + 1, total))}>
              <SkipForward className="mr-1 h-4 w-4" /> Pular (S)
            </Button>
            <Button onClick={() => setIdx((i) => Math.min(i + 1, total))}>
              Próximo (N) <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </aside>

        <section className="col-span-12 lg:col-span-8 space-y-4">
          <QualificationPanel
            key={id}
            entity={entity}
            entityId={id}
            preselectedQuestionnaireId={questionnaireId}
            queueId={queueId}
            onDecided={() => setIdx((i) => Math.min(i + 1, total))}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline de interações</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline relatedKey={relatedKey} relatedId={id} />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
