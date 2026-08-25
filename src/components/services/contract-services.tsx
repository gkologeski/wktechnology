import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Link2, Play, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listServices, activateService } from "@/lib/services.functions";
import { listJobProfileOptions } from "@/lib/job-profiles.functions";
import { SENIORITY_LABEL } from "@/lib/job-profiles-shared";
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
  canLink = true,
  parentContract = null,
}: {
  contractId: string;
  currency?: string;
  /** Só contratos de prestação (nosso CNPJ como CONTRATADA) podem associar serviços. */
  canLink?: boolean;
  /** Contrato de prestação sob o qual este contrato de compra está aninhado. */
  parentContract?: { id: string; title: string } | null;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listServices);
  const activate = useServerFn(activateService);
  const [openNew, setOpenNew] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const listProfiles = useServerFn(listJobProfileOptions);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["contract-services", contractId],
    queryFn: () => list({ data: { contractId } }),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["job-profile-options"],
    queryFn: () => listProfiles({ data: {} }) as Promise<{ id: string; name: string }[]>,
    staleTime: 60_000,
  });
  const profileName = (id: string | null | undefined) =>
    id ? (profiles.find((p) => p.id === id)?.name ?? null) : null;

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
        {canLink ? (
          <Button size="sm" variant="link" className="h-auto p-0" onClick={() => setOpenNew(true)}>
            <Link2 aria-hidden="true" className="h-3.5 w-3.5 mr-0.5" /> Associar serviço
          </Button>
        ) : null}
      </div>

      {!canLink ? (
        <p className="text-xs text-muted-foreground">
          Serviços são associados ao contrato de prestação de serviços (onde um dos nossos CNPJs é a
          CONTRATADA). Este contrato de compra apenas é aninhado sob ele.
          {parentContract ? (
            <>
              {" "}
              <Link
                to="/contracts/$id"
                params={{ id: parentContract.id }}
                className="text-primary hover:underline"
              >
                Abrir contrato de prestação
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? null : (
        <div className="space-y-2">
          {rows.map((s: any) => {
            const amount = Number(s.quantity) * Number(s.unit_price);
            return (
              <div
                key={s.id}
                className="rounded-md border p-3 group hover:border-primary/40 transition-colors"
              >
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
                {profileName(s.job_profile_id) || s.seniority ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {profileName(s.job_profile_id) ? (
                      <Badge variant="secondary">{profileName(s.job_profile_id)}</Badge>
                    ) : null}
                    {s.seniority ? (
                      <Badge variant="outline">
                        {SENIORITY_LABEL[s.seniority as string] ?? s.seniority}
                      </Badge>
                    ) : null}
                    {(s.competencies ?? []).length > 0 ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {(s.competencies as string[]).join(", ")}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-1 text-xs text-muted-foreground tabular-nums flex flex-wrap gap-x-2">
                  <span>{TYPE_LABEL[s.type] ?? s.type}</span>
                  {s.cadence ? <span>· {CADENCE_LABEL[s.cadence] ?? s.cadence}</span> : null}
                  <span>· {formatCurrency(amount, s.currency)}</span>
                  {s.next_billing_at ? (
                    <span>
                      · Próxima: {formatDateTime(s.next_billing_at as string).split(" ")[0]}
                    </span>
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

      {canLink ? (
        <LinkCatalogServiceDialog
          open={openNew}
          onOpenChange={setOpenNew}
          contractId={contractId}
          defaultCurrency={currency}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["contract-services", contractId] });
            qc.invalidateQueries({ queryKey: ["services"] });
          }}
        />
      ) : null}
    </div>
  );
}
