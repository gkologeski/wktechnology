// /workspace/modules — ativar/desativar módulos contratados (TechSales, TechHire)
// e exibir upsell visual dos não contratados.
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Briefcase, Users, Boxes, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  listWorkspaceModules,
  toggleWorkspaceModule,
  type WorkspaceModuleRow,
} from "@/lib/workspace/modules.functions";
import { buildModuleUrl } from "@/lib/hosts";
import { MODULES, type ModuleId } from "@/lib/modules/registry";

export const Route = createFileRoute("/_authenticated/workspace/modules")({
  component: WorkspaceModules,
});

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  briefcase: Briefcase,
  users: Users,
};

function iconFor(name: string | null) {
  if (name && ICONS[name]) return ICONS[name];
  return Boxes;
}

function openModule(moduleId: ModuleId) {
  const target = MODULES[moduleId]?.defaultRoute ?? "/";
  const url = buildModuleUrl(moduleId, target);
  window.location.assign(url);
}

function WorkspaceModules() {
  const listFn = useServerFn(listWorkspaceModules);
  const toggleFn = useServerFn(toggleWorkspaceModule);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["workspace-modules"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  const mut = useMutation({
    mutationFn: (vars: { moduleId: string; enabled: boolean }) => toggleFn({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(vars.enabled ? "Módulo ativado" : "Módulo desativado");
      qc.invalidateQueries({ queryKey: ["workspace-modules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="container max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Módulos contratados</h1>
        <p className="text-sm text-muted-foreground">
          Ative os produtos da sua assinatura. Você pode desabilitar temporariamente sem cancelar.
        </p>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data ?? []).map((m: WorkspaceModuleRow) => {
            const Icon = iconFor(m.icon);
            const product = m.default_product_name ?? m.name;
            return (
              <Card key={m.id} className="relative overflow-hidden">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{product}</CardTitle>
                        <CardDescription className="text-xs">Módulo {m.name}</CardDescription>
                      </div>
                    </div>
                    {m.is_contracted ? (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Contratado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <Sparkles className="h-3 w-3" /> Add-on
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {m.is_contracted ? (
                    <>
                      <div className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <div className="text-sm font-medium">Status</div>
                          <div className="text-xs text-muted-foreground">
                            {m.enabled
                              ? "Visível na barra de aplicativos e acessível para os usuários."
                              : "Oculto — usuários não vêem este módulo."}
                          </div>
                        </div>
                        <Switch
                          checked={m.enabled}
                          disabled={mut.isPending}
                          onCheckedChange={(v) => mut.mutate({ moduleId: m.id, enabled: v })}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={!m.enabled}
                        onClick={() => openModule(m.id as ModuleId)}
                      >
                        Abrir {product}
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Desbloqueie {product} para o seu workspace. Você pode ativar agora no plano
                        de avaliação.
                      </p>
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={mut.isPending}
                        onClick={() => mut.mutate({ moduleId: m.id, enabled: true })}
                      >
                        Ativar {product}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
