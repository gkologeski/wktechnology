import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  LegalEntitySelect,
  useLegalEntityFilter,
  useLegalEntityFilterInput,
} from "@/components/finance/legal-entity-select";

// -----------------------------------------------------------------
// Inline server function: list cost centers with totals
// -----------------------------------------------------------------
const listCostCentersWithTotals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    input === undefined
      ? {
          legalEntityId: undefined as string | undefined,
          legalEntityIds: undefined as string[] | undefined,
        }
      : (input as { legalEntityId?: string; legalEntityIds?: string[] }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const legalEntityId = data?.legalEntityId;
    const legalEntityIds = data?.legalEntityIds;
    let ccQ = supabase
      .from("financial_cost_centers")
      .select("id, name, parent_id, legal_entity_id, active")
      .eq("workspace_id", workspaceId)
      .order("name");
    if (legalEntityId) ccQ = ccQ.eq("legal_entity_id", legalEntityId);
    if (legalEntityIds && legalEntityIds.length) ccQ = ccQ.in("legal_entity_id", legalEntityIds);

    let allocQ = supabase
      .from("financial_entry_allocations")
      .select(
        "cost_center_id, amount, financial_entries!inner(workspace_id, direction, legal_entity_id)",
      )
      .eq("financial_entries.workspace_id", workspaceId);
    if (legalEntityId) allocQ = allocQ.eq("financial_entries.legal_entity_id", legalEntityId);
    if (legalEntityIds && legalEntityIds.length)
      allocQ = allocQ.in("financial_entries.legal_entity_id", legalEntityIds);

    const [ccRes, leRes, allocRes] = await Promise.all([
      ccQ,
      supabase.from("legal_entities").select("id, code, name").eq("workspace_id", workspaceId),
      allocQ,
    ]);
    if (ccRes.error) throw ccRes.error;
    if (leRes.error) throw leRes.error;
    if (allocRes.error) throw allocRes.error;

    const totals = new Map<string, { count: number; receivable: number; payable: number }>();
    (allocRes.data ?? []).forEach((row) => {
      const r = row as {
        cost_center_id: string;
        amount: number;
        financial_entries: { direction: string };
      };
      const t = totals.get(r.cost_center_id) ?? { count: 0, receivable: 0, payable: 0 };
      t.count += 1;
      if (r.financial_entries?.direction === "receivable") t.receivable += Number(r.amount) || 0;
      else t.payable += Number(r.amount) || 0;
      totals.set(r.cost_center_id, t);
    });

    return {
      centers: (ccRes.data ?? []).map((c) => ({
        ...c,
        totals: totals.get(c.id) ?? { count: 0, receivable: 0, payable: 0 },
      })),
      legalEntities: leRes.data ?? [],
    };
  });

export const Route = createFileRoute("/_authenticated/finance/cost-centers")({
  head: () => ({ meta: [{ title: "Centros de custo" }] }),
  component: CostCentersPage,
});

type CC = {
  id: string;
  name: string;
  parent_id: string | null;
  legal_entity_id: string | null;
  active: boolean;
  totals: { count: number; receivable: number; payable: number };
};
type Node = CC & { children: Node[] };

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function buildTree(rows: CC[]): Node[] {
  const byId = new Map<string, Node>();
  rows.forEach((r) => byId.set(r.id, { ...r, children: [] }));
  const roots: Node[] = [];
  byId.forEach((n) => {
    if (n.parent_id && byId.has(n.parent_id)) byId.get(n.parent_id)!.children.push(n);
    else roots.push(n);
  });
  const sort = (ns: Node[]) => {
    ns.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    ns.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

function CostCentersPage() {
  const fetchFn = useServerFn(listCostCentersWithTotals);
  const [legalEntityId, setLegalEntityId] = useLegalEntityFilter();
  const filterInput = useLegalEntityFilterInput(legalEntityId);
  const { data, isLoading } = useQuery({
    queryKey: ["cost-centers", legalEntityId, JSON.stringify(filterInput)],
    queryFn: () =>
      fetchFn({ data: filterInput }) as Promise<{
        centers: CC[];
        legalEntities: { id: string; code: string | null; name: string }[];
      }>,
  });

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const tree = useMemo(() => buildTree(data?.centers ?? []), [data]);
  const leById = useMemo(() => {
    const m = new Map<string, { code: string | null; name: string }>();
    (data?.legalEntities ?? []).forEach((le) => m.set(le.id, le));
    return m;
  }, [data]);

  function toggle(id: string) {
    setExpanded((p) => ({ ...p, [id]: !(p[id] ?? true) }));
  }

  function renderNode(n: Node, depth: number) {
    const hasChildren = n.children.length > 0;
    const isOpen = expanded[n.id] ?? true;
    const le = n.legal_entity_id ? leById.get(n.legal_entity_id) : null;
    return (
      <div key={n.id}>
        <div
          className="group flex items-center gap-2 border-b px-3 py-2 hover:bg-muted/40"
          style={{ paddingLeft: 12 + depth * 20 }}
        >
          <button
            type="button"
            onClick={() => hasChildren && toggle(n.id)}
            className="text-muted-foreground"
            aria-label={hasChildren ? (isOpen ? "Recolher" : "Expandir") : "Sem filhos"}
          >
            {hasChildren ? (
              isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )
            ) : (
              <span className="inline-block h-4 w-4" />
            )}
          </button>
          <span className="font-medium">{n.name}</span>
          {le && (
            <Badge variant="outline" className="text-xs">
              {le.code ?? le.name}
            </Badge>
          )}
          {!n.active && <Badge variant="secondary">Inativo</Badge>}
          <div className="ml-auto flex items-center gap-6 text-xs text-muted-foreground tabular-nums">
            <span>{n.totals.count} lanç.</span>
            <span className="text-emerald-600 w-28 text-right">{fmt(n.totals.receivable)}</span>
            <span className="text-rose-600 w-28 text-right">{fmt(n.totals.payable)}</span>
          </div>
        </div>
        {hasChildren && isOpen && n.children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  }

  const totalReceivable = (data?.centers ?? []).reduce((s, c) => s + c.totals.receivable, 0);
  const totalPayable = (data?.centers ?? []).reduce((s, c) => s + c.totals.payable, 0);

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Centros de custo"
        description="Hierarquia de centros de custo por empresa. Valores agregados dos rateios de lançamentos."
        actions={<LegalEntitySelect value={legalEntityId} onChange={setLegalEntityId} />}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Centros de custo</div>
          <div className="text-2xl font-semibold tabular-nums truncate">
            {data?.centers.length ?? 0}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Total receitas rateadas</div>
          <div className="text-2xl font-semibold tabular-nums truncate text-emerald-600">
            {fmt(totalReceivable)}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Total despesas rateadas</div>
          <div className="text-2xl font-semibold tabular-nums truncate text-rose-600">
            {fmt(totalPayable)}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>Nome</span>
          <div className="ml-auto flex items-center gap-6">
            <span>Lançamentos</span>
            <span className="w-28 text-right">Receita</span>
            <span className="w-28 text-right">Despesa</span>
          </div>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : tree.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum centro de custo cadastrado.
          </div>
        ) : (
          <div>{tree.map((n) => renderNode(n, 0))}</div>
        )}
      </div>
    </div>
  );
}
