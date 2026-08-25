// Seção do /settings/billing — gerencia planos e ativação por módulo do ERP.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Boxes, Power } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listWorkspaceModules,
  setWorkspaceModuleEnabled,
  setWorkspaceModulePlan,
} from "@/lib/modules/workspace-modules.functions";
import { PLAN_LABELS, type PlanCode } from "@/lib/entitlements";

const PLAN_CODES: PlanCode[] = ["free", "bronze", "prata", "ouro"];

export function ModulePlansSection() {
  const listFn = useServerFn(listWorkspaceModules);
  const setEnabledFn = useServerFn(setWorkspaceModuleEnabled);
  const setPlanFn = useServerFn(setWorkspaceModulePlan);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["billing", "workspace-modules"],
    queryFn: () => listFn(),
  });

  const enableMut = useMutation({
    mutationFn: (v: { module_id: string; enabled: boolean }) => setEnabledFn({ data: v }),
    onSuccess: () => {
      toast.success("Módulo atualizado");
      qc.invalidateQueries({ queryKey: ["billing", "workspace-modules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const planMut = useMutation({
    mutationFn: (v: { module_id: string; plan_code: PlanCode }) => setPlanFn({ data: v }),
    onSuccess: () => {
      toast.success("Plano do módulo alterado");
      qc.invalidateQueries({ queryKey: ["billing", "workspace-modules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const modules = query.data?.modules ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" />
              Planos por módulo
            </CardTitle>
            <CardDescription>
              Ative módulos do ERP e escolha um plano independente para cada um. A fatura é
              unificada por workspace.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {query.isLoading && <p className="text-sm text-muted-foreground">Carregando módulos…</p>}
        {!query.isLoading && modules.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum módulo configurado.</p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {modules.map((m) => (
            <div
              key={m.module_id}
              className="rounded-md border p-4 space-y-3"
              style={{ borderLeft: `3px solid ${m.default_color}` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {m.product_name}
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {m.module_name}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {m.enabled
                      ? m.activated_at
                        ? `Ativado em ${new Date(m.activated_at).toLocaleDateString("pt-BR")}`
                        : "Ativo"
                      : "Inativo"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Power className="h-3.5 w-3.5 text-muted-foreground" />
                  <Switch
                    checked={m.enabled}
                    disabled={enableMut.isPending}
                    onCheckedChange={(v) =>
                      enableMut.mutate({ module_id: m.module_id, enabled: v })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">Plano</div>
                <Select
                  value={m.plan_code ?? "free"}
                  disabled={!m.enabled || planMut.isPending}
                  onValueChange={(v) =>
                    planMut.mutate({ module_id: m.module_id, plan_code: v as PlanCode })
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_CODES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {PLAN_LABELS[code]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {m.plan_price_monthly !== null && (
                <div className="text-right text-xs text-muted-foreground">
                  R$ {Number(m.plan_price_monthly).toFixed(2)} / mês
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
