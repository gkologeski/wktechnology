import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Link2, Play, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listServices, activateService } from "@/lib/services.functions";
import { formatCurrency, formatDateTime } from "@/lib/crm";
import { LinkCatalogServiceDialog } from "@/components/services/link-catalog-service-dialog";


const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  active: "Ativo",
  paused: "Pausado",
  cancelled: "Cancelado",
  completed: "Concluído",
};

const TYPE_LABEL: Record<string, string> = {
  recurring: "Recorrente",
  one_time: "Único",
  milestone: "Por marco",
  usage_based: "Por uso",
};

const CADENCE_LABEL: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
  on_delivery: "Na entrega",
};

export function ContractServices({
  contractId,
  currency = "BRL",
}: {
  contractId: string;
  currency?: string;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listServices);
  const activate = useServerFn(activateService);
  const [openNew, setOpenNew] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["contract-services", contractId],
    queryFn: () => list({ data: { contractId } }),
  });

  async function activateOne(id: string) {
    setActivatingId(id);
    try {
      await activate({ data: { id } });
      toast.success("Serviço ativado.");
      qc.invalidateQueries({ queryKey: ["contract-services", contractId] });
      qc.invalidateQueries({ queryKey: ["services"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActivatingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {rows.length === 0 ? "Nenhum serviço" : `${rows.length} serviço(s)`}
        </span>
        <Button size="sm" variant="link" className="h-auto p-0" onClick={() => setOpenNew(true)}>
          <Link2 aria-hidden="true" className="h-3.5 w-3.5 mr-0.5" /> Associar serviço
        </Button>

      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? null : (
        <div className="space-y-2">
          {rows.map((s: any) => {
            const amount = Number(s.quantity) * Number(s.unit_price);
            return (
              <div key={s.id} className="rounded-md border p-3 group hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to="/services/$id"
                    params={{ id: s.id }}
                    className="min-w-0 flex items-center gap-1 text-primary group-hover:underline"
                  >
                    <span className="font-semibold truncate">{s.name}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </Link>
                  <Badge variant="outline" className="shrink-0">
                    {STATUS_LABEL[s.status] ?? s.status}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground tabular-nums flex flex-wrap gap-x-2">
                  <span>{TYPE_LABEL[s.type] ?? s.type}</span>
                  {s.cadence ? <span>· {CADENCE_LABEL[s.cadence] ?? s.cadence}</span> : null}
                  <span>· {formatCurrency(amount, s.currency)}</span>
                  {s.next_billing_at ? (
                    <span>· Próxima: {formatDateTime(s.next_billing_at as string).split(" ")[0]}</span>
                  ) : null}
                </div>
                {s.status === "pending" ? (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => activateOne(s.id)}
                      disabled={activatingId === s.id}
                    >
                      <Play className="h-3.5 w-3.5 mr-1" />
                      {activatingId === s.id ? "Ativando…" : "Ativar"}
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <QuickCreateServiceDialog
        open={openNew}
        onOpenChange={setOpenNew}
        contractId={contractId}
        defaultCurrency={currency}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["contract-services", contractId] });
          qc.invalidateQueries({ queryKey: ["services"] });
        }}
      />
    </div>
  );
}
