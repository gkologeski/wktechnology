// Painel de entrega no negócio: evolução macro dos projetos gerados pelo contrato.
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { DeliveryTimeline } from "@/components/projects/delivery-timeline";
import { ProjectUpdateDialog } from "@/components/projects/project-update-dialog";
import { getDealDelivery, deleteProjectUpdate } from "@/lib/projects/delivery.functions";
import {
  HEALTH_VARIANT,
  formatDeliveryDate,
  healthLabel,
  projectStatusLabel,
  type DeliveryHealth,
} from "@/lib/projects/delivery-labels";
import { usePermissions } from "@/lib/access-control/use-permissions";

export function DealDeliveryPanel({ dealId }: { dealId: string }) {
  const qc = useQueryClient();
  const fetchDelivery = useServerFn(getDealDelivery);
  const removeUpdate = useServerFn(deleteProjectUpdate);
  const { can } = usePermissions();

  const canWrite = can("techprojects.project_updates.create.own");
  const canDelete = can("techprojects.project_updates.delete.workspace");

  const query = useQuery({
    queryKey: ["deal-delivery", dealId],
    queryFn: () => fetchDelivery({ data: { dealId } }),
  });

  const projects = useMemo(() => query.data?.projects ?? [], [query.data]);

  if (query.isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Entrega</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (query.isError) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Entrega</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar o acompanhamento de entrega.
          </p>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (projects.length === 0) return null;

  const onDelete = async (id: string) => {
    try {
      await removeUpdate({ data: { id } });
      toast.success("Acompanhamento excluído.");
      void qc.invalidateQueries({ queryKey: ["deal-delivery", dealId] });
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível excluir.");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Entrega</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {projects.map((p) => {
          const latest = p.updates.find((u) => u.health) ?? p.updates[0] ?? null;
          const expected =
            p.updates.find((u) => u.expected_delivery_date)?.expected_delivery_date ?? p.due_at;
          const progress = latest?.progress_pct ?? p.progress ?? 0;
          return (
            <div key={p.id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Situação: {projectStatusLabel(p.status)} · Previsão:{" "}
                    {formatDeliveryDate(expected)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {latest?.health && (
                    <Badge variant={HEALTH_VARIANT[latest.health as DeliveryHealth] ?? "outline"}>
                      {healthLabel(latest.health)}
                    </Badge>
                  )}
                  {canWrite && (
                    <ProjectUpdateDialog
                      projectId={p.id}
                      trigger={
                        <Button variant="outline" size="sm">
                          <Plus className="mr-1 h-3.5 w-3.5" /> Acompanhamento
                        </Button>
                      }
                    />
                  )}
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/projects/$id/entrega" params={{ id: p.id }}>
                      Abrir <ExternalLink className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Progress value={progress} aria-label={`Evolução do projeto ${p.name}`} />
                <p className="text-xs text-muted-foreground tabular-nums">
                  {progress}% de evolução
                </p>
              </div>
              <DeliveryTimeline
                updates={p.updates}
                canEdit={false}
                canDelete={canDelete}
                onDelete={(u) => void onDelete(u.id)}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
