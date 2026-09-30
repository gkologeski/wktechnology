// /people/benefits — visão agregada de benefícios ativos do workspace.
import { createFileRoute, Link } from "@tanstack/react-router";
import { GridListToolbar } from "@/components/grid/grid-list-toolbar";
import { SortableTableHead } from "@/components/grid/sortable-table-head";
import { useClientSort } from "@/lib/grid-client-sort";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { HeartHandshake } from "lucide-react";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BENEFIT_TYPE_LABELS,
  type PeopleBenefitRow,
  type BenefitType,
} from "@/lib/people/benefits.functions";
import { useGridSelection } from "@/components/grid/use-grid-selection";
import { GridBulkBar } from "@/components/grid/grid-bulk-bar";
import { usePermissions } from "@/lib/access-control/use-permissions";

const listWorkspaceBenefits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ only_active: z.boolean().default(true) }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("people_benefits")
      .select("*, people(id, full_name)")
      .order("active", { ascending: false })
      .order("benefit_type", { ascending: true })
      .limit(500);
    if (data.only_active) q = q.eq("active", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as (PeopleBenefitRow & {
      people?: { id: string; full_name: string } | null;
    })[];
  });

export const Route = createFileRoute("/_authenticated/people/benefits")({
  head: () => ({
    meta: [
      { title: "Benefícios · TechPeople" },
      {
        name: "description",
        content: "Benefícios ativos do workspace com valor mensal e cota do empregado.",
      },
      { property: "og:title", content: "Benefícios · TechPeople" },
      { property: "og:description", content: "Consulta consolidada de benefícios do time." },
    ],
  }),
  component: BenefitsListPage,
});

const brl = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });

function BenefitsListPage() {
  const qc = useQueryClient();
  const fn = useServerFn(listWorkspaceBenefits);
  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ["ws-benefits"],
    queryFn: () => fn({ data: { only_active: true } }),
    staleTime: 60_000,
  });
  const {
    sorted: data,
    sort,
    toggle,
    grid: sortGrid,
  } = useClientSort(rawData, {
    person: (b) => b.people?.full_name,
    type: (b) => BENEFIT_TYPE_LABELS[b.benefit_type as BenefitType] ?? b.benefit_type,
    provider: (b) => b.provider ?? b.plan_name,
    value: (b) => (b.monthly_value == null ? null : Number(b.monthly_value)),
    share: (b) => (b.employee_share == null ? null : Number(b.employee_share)),
    start: (b) => b.starts_on,
  });

  const totalMonthly = data.reduce((s, b) => s + Number(b.monthly_value ?? 0), 0);

  // Seleção múltipla / ações em massa (padrão de grids).
  const { canAny } = usePermissions();
  const selection = useGridSelection(data as Array<(typeof data)[number] & { id: string }>);
  const selectAllFiltered = () => selection.setSelectedIds(new Set(data.map((b) => b.id)));

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-4">
      <PageHeader
        title="Benefícios"
        description="Benefícios ativos em todo o workspace."
        actions={
          <div className="text-sm text-muted-foreground">
            Total mensal: <span className="font-medium text-foreground">{brl(totalMonthly)}</span>
          </div>
        }
      />

      {selection.hasSelection && (
        <GridBulkBar
          table="people_benefits"
          ids={selection.ids}
          rows={selection.selectedRows}
          entityLabel="benefício(s)"
          onClear={selection.clear}
          onDone={() => void qc.invalidateQueries({ queryKey: ["ws-benefits"] })}
          totalMatching={data.length}
          onSelectAll={selectAllFiltered}
          assignColumn={null}
          canUpdate={canAny([
            "techpeople.benefits.update.workspace",
            "techpeople.benefits.update.team",
            "techpeople.benefits.update.own",
          ])}
          canDelete={canAny([
            "techpeople.benefits.delete.workspace",
            "techpeople.benefits.delete.own",
          ])}
          bulkEditFields={[
            { name: "provider", label: "Provedor", type: "text" },
            { name: "plan_name", label: "Plano", type: "text" },
            { name: "ends_on", label: "Término", type: "date" },
          ]}
        />
      )}

      <div className="rounded-md border bg-card">
        <GridListToolbar
          grid={sortGrid}
          filename="beneficios"
          labels={{
            person: "Pessoa",
            type: "Tipo",
            provider: "Provedor / Plano",
            value: "Valor mensal",
            share: "Cota empregado",
            start: "Início",
          }}
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Selecionar todos os benefícios exibidos"
                  checked={
                    selection.allOnPageSelected
                      ? true
                      : selection.someOnPageSelected
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={selection.toggleAllOnPage}
                />
              </TableHead>
              <SortableTableHead
                label="Pessoa"
                active={sort?.key === "person"}
                dir={sort?.dir}
                onSort={() => toggle("person")}
              />
              <SortableTableHead
                label="Tipo"
                active={sort?.key === "type"}
                dir={sort?.dir}
                onSort={() => toggle("type")}
              />
              <SortableTableHead
                label="Provedor / Plano"
                active={sort?.key === "provider"}
                dir={sort?.dir}
                onSort={() => toggle("provider")}
              />
              <SortableTableHead
                label="Valor mensal"
                active={sort?.key === "value"}
                dir={sort?.dir}
                onSort={() => toggle("value")}
                className="text-right"
                align="right"
              />
              <SortableTableHead
                label="Cota empregado"
                active={sort?.key === "share"}
                dir={sort?.dir}
                onSort={() => toggle("share")}
                className="text-right"
                align="right"
              />
              <SortableTableHead
                label="Início"
                active={sort?.key === "start"}
                dir={sort?.dir}
                onSort={() => toggle("start")}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <HeartHandshake className="h-8 w-8 text-muted-foreground" />
                    <div className="text-sm font-medium">Nenhum benefício ativo</div>
                    <div className="text-xs text-muted-foreground">
                      Cadastre benefícios na ficha da pessoa (aba Benefícios).
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((b) => (
                <TableRow key={b.id} className="hover:bg-muted/40">
                  <TableCell>
                    <Checkbox
                      aria-label={`Selecionar benefício ${BENEFIT_TYPE_LABELS[b.benefit_type as BenefitType] ?? b.benefit_type}`}
                      checked={selection.selectedIds.has(b.id)}
                      onCheckedChange={() => selection.toggleOne(b.id)}
                    />
                  </TableCell>
                  <TableCell>
                    {b.people ? (
                      <Link
                        to="/people/$id"
                        params={{ id: b.people.id }}
                        className="font-medium hover:underline"
                      >
                        {b.people.full_name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {BENEFIT_TYPE_LABELS[b.benefit_type as BenefitType] ?? b.benefit_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{b.provider ?? "—"}</div>
                    {b.plan_name ? (
                      <div className="text-xs text-muted-foreground">{b.plan_name}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">{brl(b.monthly_value)}</TableCell>
                  <TableCell className="text-right">{brl(b.employee_share)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {b.starts_on ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
