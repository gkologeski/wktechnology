// Visão macro de entrega de um projeto (somente leitura, sem marcos/tarefas/horas).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { DeliveryTimeline } from "@/components/projects/delivery-timeline";
import { ProjectUpdateDialog } from "@/components/projects/project-update-dialog";
import {
  getProjectDelivery,
  deleteProjectUpdate,
  type ProjectUpdateRow,
} from "@/lib/projects/delivery.functions";
import {
  HEALTH_VARIANT,
  formatDeliveryDate,
  healthLabel,
  projectStatusLabel,
  type DeliveryHealth,
} from "@/lib/projects/delivery-labels";
import { usePermissions } from "@/lib/access-control/use-permissions";

export const Route = createFileRoute("/_authenticated/projects_/$id/entrega")({
  component: ProjectDeliveryPage,
});

function ProjectDeliveryPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fetchDelivery = useServerFn(getProjectDelivery);
  const removeUpdate = useServerFn(deleteProjectUpdate);
  const { can } = usePermissions();
  const [editing, setEditing] = useState<ProjectUpdateRow | null>(null);

  const canWrite = can("techprojects.project_updates.create.own");
  const canEdit =
    can("techprojects.project_updates.update.own") ||
    can("techprojects.project_updates.update.workspace");
  const canDelete = can("techprojects.project_updates.delete.workspace");

  const query = useQuery({
    queryKey: ["project-delivery", id],
    queryFn: () => fetchDelivery({ data: { projectId: id } }),
  });

  const project = query.data?.project ?? null;

  const onDelete = async (updateId: string) => {
    try {
      await removeUpdate({ data: { id: updateId } });
      toast.success("Acompanhamento excluído.");
      void qc.invalidateQueries({ queryKey: ["project-delivery", id] });
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível excluir.");
    }
  };

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="space-y-3">
        <PageHeader title="Acompanhamento de entrega" />
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar o acompanhamento deste projeto.
        </p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-3">
        <PageHeader title="Acompanhamento de entrega" />
        <p className="text-sm text-muted-foreground">
          Projeto não encontrado ou você não tem acesso ao acompanhamento dele.
        </p>
      </div>
    );
  }

  const latest = project.updates.find((u) => u.health) ?? project.updates[0] ?? null;
  const expected =
    project.updates.find((u) => u.expected_delivery_date)?.expected_delivery_date ?? project.due_at;
  const progress = latest?.progress_pct ?? project.progress ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={project.name}
        description="Acompanhamento macro da evolução e previsão de entrega"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/projects">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Projetos
              </Link>
            </Button>
            {canWrite && (
              <ProjectUpdateDialog
                projectId={project.id}
                trigger={
                  <Button size="sm">
                    <Plus className="mr-1 h-3.5 w-3.5" /> Publicar acompanhamento
                  </Button>
                }
              />
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Farol</CardTitle>
          </CardHeader>
          <CardContent>
            {latest?.health ? (
              <Badge variant={HEALTH_VARIANT[latest.health as DeliveryHealth] ?? "outline"}>
                {healthLabel(latest.health)}
              </Badge>
            ) : (
              <p className="text-sm text-muted-foreground">Sem farol informado</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Previsão de entrega
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold tabular-nums">{formatDeliveryDate(expected)}</p>
            <p className="text-xs text-muted-foreground">
              Situação: {projectStatusLabel(project.status)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Evolução</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-lg font-semibold tabular-nums">{progress}%</p>
            <Progress value={progress} aria-label="Evolução do projeto" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Linha do tempo</CardTitle>
        </CardHeader>
        <CardContent>
          <DeliveryTimeline
            updates={project.updates}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={(u) => setEditing(u)}
            onDelete={(u) => void onDelete(u.id)}
          />
        </CardContent>
      </Card>

      {editing && (
        <ProjectUpdateDialog
          projectId={project.id}
          update={editing}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      )}
    </div>
  );
}
