// Diagnóstico e correção em lote do papel (Prestação/Compra) dos contratos importados.
// Componente de apresentação: consome apenas as server functions de diagnóstico/recálculo.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw, ScanSearch } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  diagnoseContractRoles,
  recalcContractRoles,
  type ContractRolesDiagnosis,
} from "@/lib/contracts/role-recalc.functions";

const ROLE_LABEL: Record<string, string> = {
  provider: "Prestação (somos a CONTRATADA)",
  client: "Compra (somos a CONTRATANTE)",
};

export function ContractRolesRecalcDialog({
  onOpenChange,
  onApplied,
}: {
  onOpenChange: (open: boolean) => void;
  onApplied?: () => void;
}) {
  const diagnose = useServerFn(diagnoseContractRoles);
  const recalc = useServerFn(recalcContractRoles);
  const qc = useQueryClient();

  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [retitle, setRetitle] = useState(true);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["contract-roles-diagnosis"],
    queryFn: () => diagnose() as Promise<ContractRolesDiagnosis>,
  });

  const conflicts = data?.conflicts ?? [];
  const ids = useMemo(() => selected ?? new Set(conflicts.map((c) => c.id)), [selected, conflicts]);

  const toggle = (id: string) => {
    const next = new Set(ids);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const apply = useMutation({
    mutationFn: () => recalc({ data: { ids: Array.from(ids), retitle } }),
    onSuccess: (res) => {
      toast.success(
        `${res.updated} contrato(s) corrigido(s)${res.retitled ? ` · ${res.retitled} título(s) padronizado(s)` : ""}.`,
      );
      void qc.invalidateQueries({ queryKey: ["contract-roles-diagnosis"] });
      void qc.invalidateQueries({ queryKey: ["contracts"] });
      void qc.invalidateQueries({ queryKey: ["contracts-pending-link"] });
      onApplied?.();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanSearch className="h-4 w-4" aria-hidden="true" />
            Recalcular papéis dos contratos
          </DialogTitle>
          <DialogDescription>
            O papel é derivado das empresas do workspace: quando somos a CONTRATADA o contrato é de
            Prestação; quando somos a CONTRATANTE é de Compra. Nada é alterado sem sua confirmação.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/60" />
            ))}
          </div>
        ) : isError ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Não foi possível analisar: {(error as Error)?.message}</p>
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Analisados" value={data?.total ?? 0} />
              <Metric label="Coerentes" value={data?.coherent ?? 0} />
              <Metric label="Divergentes" value={conflicts.length} tone="warning" />
              <Metric label="Sem evidência" value={data?.unknown ?? 0} />
            </div>

            {data && data.own_entities_with_cnpj === 0 ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Nenhuma das {data.own_entities} empresas do workspace tem CNPJ preenchido. A
                  identificação está sendo feita apenas pelo nome — preencha os CNPJs em Empresas do
                  workspace para maior precisão.
                </span>
              </div>
            ) : null}

            {conflicts.length === 0 ? (
              <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                Nenhum contrato com papel divergente das empresas do workspace.
              </div>
            ) : (
              <>
                <ScrollArea className="max-h-[45vh] rounded-lg border">
                  <ul className="divide-y">
                    {conflicts.map((c) => (
                      <li key={c.id} className="flex items-start gap-3 p-3">
                        <Checkbox
                          checked={ids.has(c.id)}
                          onCheckedChange={() => toggle(c.id)}
                          aria-label={`Selecionar ${c.number ?? c.title}`}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              to="/contracts/$id"
                              params={{ id: c.id }}
                              className="truncate text-sm font-medium hover:underline"
                            >
                              {c.number ? `${c.number} · ` : ""}
                              {c.title}
                            </Link>
                            <Badge variant="outline" className="text-[10px]">
                              {c.matched_by === "cnpj" ? "Casou por CNPJ" : "Casou por nome"}
                            </Badge>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Gravado: {ROLE_LABEL[c.stored_role] ?? c.stored_role} → Correto:{" "}
                            <span className="font-medium text-foreground">
                              {ROLE_LABEL[c.inferred_role] ?? c.inferred_role}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            CONTRATANTE: {c.contracting_name ?? "—"} · CONTRATADA:{" "}
                            {c.counterparty_name ?? "—"}
                          </div>
                          {retitle && c.suggested_title ? (
                            <div className="text-[11px] text-muted-foreground">
                              Novo título: {c.suggested_title}
                            </div>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>

                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={retitle}
                    onCheckedChange={(v) => setRetitle(Boolean(v))}
                    aria-label="Regravar título padronizado"
                  />
                  Regravar também o título padronizado ([PRESTAÇÃO]/[COMPRA])
                </label>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            onClick={() => apply.mutate()}
            disabled={apply.isPending || ids.size === 0 || conflicts.length === 0}
          >
            {apply.isPending ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Corrigir {ids.size} contrato(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "warning" }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`text-lg font-semibold ${tone === "warning" && value > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}
