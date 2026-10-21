// Lista paginada de medições por projeto ou contrato. Nova medição só no contrato (a competência é
// agregada por contrato/serviço, nunca replicada por projeto). Abrir a lista não cria nada.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { EmptyState, RowSkeleton, SectionHeader } from "@/components/techhire/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { buildMeasurement, listMeasurements } from "@/lib/projects/billing.functions";
import { listBillingConfigs } from "@/lib/projects/billing-rates.functions";
import {
  BILLING_MODEL_LABEL,
  MEASUREMENT_STATUS_LABEL,
  formatMoney,
  measurementStatusVariant,
} from "@/lib/projects/billing.shared";
import { browserTimeZone, formatSeconds } from "@/lib/projects/time-entry.shared";
import { MeasurementDetailDialog } from "./measurement-detail-dialog";

const PAGE = 20;
const label = (iso: string) => {
  const [y, mo] = iso.split("-");
  return `${mo}/${y}`;
};

export function MeasurementsPanel({
  projectId,
  contractId,
}: {
  projectId?: string;
  contractId?: string;
}) {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const listFn = useServerFn(listMeasurements);
  const cfgFn = useServerFn(listBillingConfigs);
  const buildFn = useServerFn(buildMeasurement);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cfgId, setCfgId] = useState("");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    const x = new Date(d.getFullYear(), d.getMonth() - 1, 1, 12);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
  });
  const [kind, setKind] = useState<"regular" | "complement">("regular");

  const list = useQuery({
    queryKey: ["measurements", projectId ?? null, contractId ?? null, page],
    queryFn: () => listFn({ data: { projectId, contractId, page, pageSize: PAGE } }),
    retry: false,
  });
  const configs = useQuery({
    queryKey: ["billing-configs", contractId],
    queryFn: () => cfgFn({ data: { contractId: contractId as string } }),
    enabled: Boolean(contractId),
    retry: false,
  });
  const activeConfigs = (configs.data ?? []).filter((c) => c.status === "active");
  const build = useMutation({
    mutationFn: () =>
      buildFn({
        data: { configId: cfgId, month: `${month}-01`, kind, timezone: browserTimeZone() },
      }),
    onSuccess: (r) => {
      toast.success("Rascunho da medição pronto para revisão.");
      void qc.invalidateQueries({ queryKey: ["measurements"] });
      setOpenId(r.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <SectionHeader
        title="Medições"
        description="Competência mensal por contrato/serviço: rascunho → revisão → aprovação → pronta → gerada no Financeiro. Fechar horas ou aceite do cliente não é fatura nem recebimento."
      />
      {contractId && can("techprojects.measurements.manage.workspace") && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
          <div className="grid min-w-[240px] gap-1">
            <Label htmlFor="m-cfg">Modelo de cobrança</Label>
            <Select value={cfgId} onValueChange={setCfgId}>
              <SelectTrigger id="m-cfg">
                <SelectValue
                  placeholder={activeConfigs.length ? "Escolha" : "Configure o modelo primeiro"}
                />
              </SelectTrigger>
              <SelectContent>
                {activeConfigs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.service_name ?? "Contrato inteiro"} · {BILLING_MODEL_LABEL[c.model]} · v
                    {c.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="m-month">Competência</Label>
            <Input
              id="m-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="m-kind">Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as "regular" | "complement")}>
              <SelectTrigger id="m-kind" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="complement">Complemento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!cfgId || !/^\d{4}-\d{2}$/.test(month) || build.isPending}
            onClick={() => build.mutate()}
          >
            Preparar medição
          </Button>
        </div>
      )}
      {projectId && (
        <p className="text-xs text-muted-foreground">
          Medições são preparadas no contrato. Aqui aparecem as que incluem este projeto ou o
          serviço dele.
        </p>
      )}

      {list.isLoading ? (
        <RowSkeleton />
      ) : list.isError ? (
        <EmptyState title="Medições indisponíveis" description={(list.error as Error).message} />
      ) : total === 0 ? (
        <EmptyState
          title="Nenhuma medição"
          description={
            contractId
              ? "Configure o modelo de cobrança do contrato e prepare a primeira competência."
              : "Ainda não há medição para este projeto."
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Tempo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Pendências</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(list.data?.rows ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {label(r.period_from)}{" "}
                      {r.kind === "complement" && <Badge variant="outline">Complemento</Badge>}
                    </TableCell>
                    <TableCell>{BILLING_MODEL_LABEL[r.model]}</TableCell>
                    <TableCell>
                      <Badge variant={measurementStatusVariant(r.status)}>
                        {MEASUREMENT_STATUS_LABEL[r.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatSeconds(r.total_seconds)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(r.total_amount, r.currency)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.blockers.length + r.gates.length || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setOpenId(r.id)}>
                        Abrir
                      </Button>
                      {projectId && (
                        <Button size="sm" variant="link" asChild>
                          <Link to="/contracts/$id/medicoes" params={{ id: r.contract_id }}>
                            Contrato
                          </Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="tabular-nums">
                {page}/{pages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}
      <MeasurementDetailDialog
        id={openId}
        open={Boolean(openId)}
        onOpenChange={(v) => !v && setOpenId(null)}
      />
    </section>
  );
}
