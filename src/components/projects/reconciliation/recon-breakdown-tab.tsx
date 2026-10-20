// Aba "Conferência": contagens e segundos do ERP × coletado da origem, por mês/pessoa/projeto.
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, FilterBar, Skeletons } from "@/components/techhire/ui";
import { IsoDateRangePicker, isoDay } from "@/components/iso-date-range-picker";
import { getReconciliationBreakdown } from "@/lib/projects/reconciliation.functions";
import {
  PROVIDER_LABEL,
  RECON_PROVIDERS,
  formatSeconds,
  type ReconProvider,
} from "@/lib/projects/reconciliation-labels";

const PAGE = 50;
const GROUP_LABEL = { month: "Mês", person: "Pessoa", project: "Projeto" } as const;
type Group = keyof typeof GROUP_LABEL;

export function ReconBreakdownTab({
  from,
  to,
  onPeriod,
}: {
  from?: string;
  to?: string;
  onPeriod: (from: string, to: string) => void;
}) {
  const f = from ?? "2020-01-01";
  const t = to ?? isoDay(new Date());
  const [provider, setProvider] = useState<ReconProvider>("all");
  const [group, setGroup] = useState<Group>("month");
  const [page, setPage] = useState(1);
  const get = useServerFn(getReconciliationBreakdown);
  const q = useQuery({
    queryKey: ["recon-breakdown", provider, group, f, t, page],
    queryFn: () => get({ data: { provider, group, from: f, to: t, page, pageSize: PAGE } }),
    placeholderData: keepPreviousData,
  });
  const pages = Math.max(1, Math.ceil((q.data?.total ?? 0) / PAGE));
  return (
    <div className="space-y-4">
      <FilterBar
        chips={
          <>
            <Label className="sr-only" htmlFor="recon-bd-provider">Fonte</Label>
            <Select value={provider} onValueChange={(v) => { setProvider(v as ReconProvider); setPage(1); }}>
              <SelectTrigger id="recon-bd-provider" className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RECON_PROVIDERS.map((p) => <SelectItem key={p} value={p}>{PROVIDER_LABEL[p]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Label className="sr-only" htmlFor="recon-bd-group">Agrupar por</Label>
            <Select value={group} onValueChange={(v) => { setGroup(v as Group); setPage(1); }}>
              <SelectTrigger id="recon-bd-group" className="h-8 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(GROUP_LABEL) as Group[]).map((g) => <SelectItem key={g} value={g}>Por {GROUP_LABEL[g].toLowerCase()}</SelectItem>)}
              </SelectContent>
            </Select>
            <IsoDateRangePicker size="sm" ariaLabel="Período da conferência" from={f} to={t} onChange={(r) => { setPage(1); onPeriod(r.from, r.to); }} />
          </>
        }
      />
      <p className="text-xs text-text-tertiary">
        ERP = soma exata dos carimbos de início e fim. Coletado = segundos guardados da origem no momento da importação. A diferença só aparece para registros com origem comprovada.
      </p>
      {q.isLoading ? (
        <Skeletons.Card lines={8} />
      ) : q.isError ? (
        <EmptyState icon={AlertTriangle} title="Não foi possível carregar a conferência" description={(q.error as Error).message} action={<Button onClick={() => void q.refetch()}>Tentar novamente</Button>} />
      ) : (q.data?.rows.length ?? 0) === 0 ? (
        <EmptyState title="Nada no período" description="Ajuste a fonte ou o período." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{GROUP_LABEL[group]}</TableHead>
                <TableHead className="text-right">Registros no ERP</TableHead>
                <TableHead className="text-right">Horas no ERP</TableHead>
                <TableHead className="text-right">Com origem</TableHead>
                <TableHead className="text-right">Coletado da origem</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
                <TableHead className="text-right">Com alerta aberto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data!.rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="max-w-64 truncate">{r.label ?? "Sem nome"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.erpRows.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatSeconds(r.erpSeconds)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.linkedRows.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatSeconds(r.sourceSeconds)}</TableCell>
                  <TableCell className={r.diffSeconds ? "text-right tabular-nums text-status-onhold" : "text-right tabular-nums"}>
                    {r.diffSeconds === null ? "Sem origem" : formatSeconds(r.diffSeconds)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.rowsWithOpenIssues.toLocaleString("pt-BR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between text-sm text-text-secondary">
            <span>{q.data!.total.toLocaleString("pt-BR")} grupos · página {page} de {pages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
