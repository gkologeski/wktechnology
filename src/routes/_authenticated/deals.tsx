import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus,
  Play,
  LayoutGrid,
  List as ListIcon,
  Table as TableIcon,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { startFocusQueue } from "@/lib/focus-queue";
import type { Deal, Company, Contact } from "@/lib/db-types";
import { usePipelines, useEnsureDefaultPipeline } from "@/lib/pipelines";
import { usePipelineSubstatuses } from "@/lib/pipelines/substatuses";
import {
  DealsToolbar,
  EMPTY_DEAL_FILTERS,
  type DealFilters,
} from "@/components/deals/deals-toolbar";
import { getDateRange } from "@/lib/date-presets";
import { DealsBoard, type DealLookups } from "@/components/deals/deals-board";
import { computeDealSignals } from "@/lib/deals/hot-score";
import { DealsList } from "@/components/deals/deals-list";
import { DealsForecast } from "@/components/deals/deals-forecast";
import { DealsHubspotTable } from "@/components/deals/deals-hubspot-table";
import { DealDetailDrawer } from "@/components/deals/deal-detail-drawer";
import { useAutoCreateParam } from "@/hooks/use-auto-create-param";
import { Can, usePermissions } from "@/lib/access-control/use-permissions";
import { useGridProjection } from "@/hooks/use-grid-projection";
import { buildGridSelect } from "@/lib/grid/dynamic-select";

/** Colunas sempre necessárias nas visões de negócios (tabela, kanban, lista, previsão). */
const BASE_DEAL_KEYS = [
  "id",
  "name",
  "value",
  "currency",
  "stage",
  "stage_id",
  "pipeline_id",
  "company_id",
  "primary_contact_id",
  "owner_id",
  "assigned_to",
  "assigned_user_id",
  "hubspot_owner_id",
  "dealtype",
  "expected_close_date",
  "closed_at",
  "lost_at",
  "created_at",
  "updated_at",
] as const;

export const Route = createFileRoute("/_authenticated/deals")({
  component: DealsRoute,
});

function DealsRoute() {
  const location = useLocation();
  if (location.pathname !== "/deals") return <Outlet />;
  return <DealsPage />;
}

function DealsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { canAny } = usePermissions();
  // Mesmas chaves usadas nas ações do grid/detalhe: a RLS continua validando.
  const canUpdateDeals = canAny([
    "techsales.deals.update.own",
    "techsales.deals.update.team",
    "techsales.deals.update.workspace",
  ]);
  const canDeleteDeals = canAny([
    "techsales.deals.delete.own",
    "techsales.deals.delete.team",
    "techsales.deals.delete.workspace",
  ]);
  useEnsureDefaultPipeline("deal");
  const { pipelines, selected, selectedId, setSelectedId } = usePipelines("deal");
  const { data: substatuses = [] } = usePipelineSubstatuses(selected?.id);

  useRealtimeInvalidate([
    { table: "deals", queryKeys: [["deals", "list"]] },
    { table: "activities", queryKeys: [["deals", "next-activities"]] },
  ]);

  // Parâmetros de URL vindos do dashboard (ex.: /deals?closedFrom=2026-01-01&closedTo=2026-01-31)
  const [filters, setFilters] = useState<DealFilters>(() => {
    const sp =
      typeof window === "undefined"
        ? new URLSearchParams()
        : new URLSearchParams(window.location.search);
    const closedFrom = sp.get("closedFrom") ?? "";
    const closedTo = sp.get("closedTo") ?? "";
    return {
      ...EMPTY_DEAL_FILTERS,
      ...(closedFrom || closedTo
        ? { closedPeriod: "custom" as const, closedStart: closedFrom, closedEnd: closedTo }
        : {}),
    };
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const DEALS_VIEW_KEY = "deals:view";
  const DEALS_FOCUS_KEY = "deals:focusMode";
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(DEALS_FOCUS_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(DEALS_FOCUS_KEY, focusMode ? "1" : "0");
    } catch {
      /* noop */
    }
  }, [focusMode]);
  const [view, setView] = useState<"table" | "board" | "list" | "forecast">(() => {
    if (typeof window === "undefined") return "board";
    try {
      const saved = localStorage.getItem(DEALS_VIEW_KEY);
      if (saved && ["table", "board", "list", "forecast"].includes(saved)) {
        return saved as "table" | "board" | "list" | "forecast";
      }
    } catch {
      // ignore
    }
    return "board";
  });

  // Persiste a última visualização escolhida pelo usuário.
  useEffect(() => {
    try {
      localStorage.setItem(DEALS_VIEW_KEY, view);
    } catch {
      // ignore
    }
  }, [view]);

  const projection = useGridProjection({ gridKey: "deals", entity: "deals" });

  const { data: deals = [] } = useQuery({
    queryKey: ["deals", "list", projection.selectSignature, projection.needsCustomFields],
    enabled: !projection.isLoading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        // Projeção sob demanda: colunas base + colunas visíveis do catálogo.
        .select(
          buildGridSelect(BASE_DEAL_KEYS, projection.selectKeys, {
            customFields: projection.needsCustomFields,
            allowed: projection.knownColumns,
          }),
        )
        .order("created_at", { ascending: false })
        .range(0, 999);
      if (error) throw error;
      return (data ?? []) as unknown as Deal[];
    },
    refetchOnMount: "always",
  });

  const { data: nextActivities = new Map<string, string>() } = useQuery({
    queryKey: ["deals", "next-activities"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const map = new Map<string, string>();
      // 1) Próximas atividades futuras (mais próximas primeiro), por deal.
      const future = await supabase
        .from("activities")
        .select("related_deal_id,due_date")
        .eq("completed", false)
        .not("related_deal_id", "is", null)
        .gte("due_date", nowIso)
        .order("due_date", { ascending: true })
        .range(0, 5000);
      if (future.error) throw future.error;
      for (const a of (future.data ?? []) as {
        related_deal_id: string | null;
        due_date: string | null;
      }[]) {
        if (a.related_deal_id && a.due_date && !map.has(a.related_deal_id)) {
          map.set(a.related_deal_id, a.due_date);
        }
      }
      // 2) Para deals sem atividade futura, pega a mais recente vencida.
      const overdue = await supabase
        .from("activities")
        .select("related_deal_id,due_date")
        .eq("completed", false)
        .not("related_deal_id", "is", null)
        .lt("due_date", nowIso)
        .order("due_date", { ascending: false })
        .range(0, 5000);
      if (overdue.error) throw overdue.error;
      for (const a of (overdue.data ?? []) as {
        related_deal_id: string | null;
        due_date: string | null;
      }[]) {
        if (a.related_deal_id && a.due_date && !map.has(a.related_deal_id)) {
          map.set(a.related_deal_id, a.due_date);
        }
      }
      return map;
    },
    staleTime: 60_000,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies", "select"],
    queryFn: async () =>
      ((await supabase.from("companies").select("id,name").order("name")).data as Pick<
        Company,
        "id" | "name"
      >[]) ?? [],
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", "select"],
    queryFn: async () =>
      ((await supabase.from("contacts").select("id,first_name,last_name").order("first_name"))
        .data as Pick<Contact, "id" | "first_name" | "last_name">[]) ?? [],
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles", "select"],
    queryFn: async () =>
      ((await supabase.from("profiles").select("id,full_name")).data as {
        id: string;
        full_name: string | null;
      }[]) ?? [],
  });

  const lookups: DealLookups = useMemo(() => {
    const c = new Map<string, string>();
    companies.forEach((x) => c.set(x.id, x.name));
    const ct = new Map<string, string>();
    contacts.forEach((x) => ct.set(x.id, `${x.first_name} ${x.last_name ?? ""}`.trim()));
    const o = new Map<string, string>();
    profiles.forEach((x) => o.set(x.id, x.full_name ?? "—"));
    if (user) o.set(user.id, profiles.find((p) => p.id === user.id)?.full_name ?? "Você");
    return { companies: c, contacts: ct, owners: o };
  }, [companies, contacts, profiles, user]);

  const ownerOptions = useMemo(() => {
    const ids = new Set<string>(profiles.map((p) => p.id));
    deals.forEach((d) => {
      if (d.owner_id) ids.add(d.owner_id);
    });
    return Array.from(ids).map((id) => ({ id, name: lookups.owners.get(id) ?? id.slice(0, 8) }));
  }, [deals, lookups, profiles]);

  const filtered = useMemo(() => {
    const range =
      filters.period === "overdue" || filters.period === "no_date"
        ? { start: undefined, end: undefined }
        : getDateRange(filters.period, new Date(), {
            start: filters.customStart || undefined,
            end: filters.customEnd || undefined,
          });
    const { start, end } = range;

    const closedRange =
      filters.closedPeriod === "any"
        ? { start: undefined, end: undefined }
        : getDateRange(filters.closedPeriod, new Date(), {
            start: filters.closedStart || undefined,
            end: filters.closedEnd || undefined,
          });

    const min = Number(filters.minValue) || 0;
    const search = filters.search.trim().toLowerCase();
    return deals.filter((d) => {
      if (selected?.id && d.pipeline_id !== selected.id) return false;
      if (filters.ownerId && d.owner_id !== filters.ownerId) return false;
      if (filters.substatusIds.length > 0 && !filters.substatusIds.includes(d.stage_substatus_id ?? ""))
        return false;
      if (min > 0 && Number(d.value || 0) < min) return false;
      if (filters.period === "overdue") {
        if (!d.expected_close_date) return false;
        if (new Date(d.expected_close_date).getTime() >= Date.now()) return false;
        if (["won", "lost"].includes(String(d.stage))) return false;
      } else if (filters.period === "no_date") {
        if (d.expected_close_date) return false;
      } else if (start && end) {
        if (!d.expected_close_date) return false;
        const t = new Date(d.expected_close_date).getTime();
        if (t < start.getTime() || t >= end.getTime()) return false;
      }
      if (closedRange.start || closedRange.end) {
        // Data real de fechamento: ganhos usam closed_at, perdidos usam lost_at.
        const raw =
          String(d.stage) === "won"
            ? ((d as { closed_at?: string | null }).closed_at ?? null)
            : String(d.stage) === "lost"
              ? ((d as { lost_at?: string | null }).lost_at ?? null)
              : null;
        if (!raw) return false;
        const t = new Date(raw).getTime();
        if (closedRange.start && t < closedRange.start.getTime()) return false;
        if (closedRange.end && t >= closedRange.end.getTime()) return false;
      }
      if (search) {
        const hay = [
          d.name,
          d.company_id ? lookups.companies.get(d.company_id) : "",
          d.primary_contact_id ? lookups.contacts.get(d.primary_contact_id) : "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }, [deals, filters, selected, lookups]);

  const boardHotCount = useMemo(() => {
    if (!selected) return 0;
    const sig = computeDealSignals(filtered, selected, nextActivities);
    let n = 0;
    for (const s of sig.values()) if (s.isHot) n++;
    return n;
  }, [filtered, selected, nextActivities]);

  const openNew = () => {
    setEditing(null);
    setDrawerOpen(true);
  };
  useAutoCreateParam(openNew);

  const openEdit = (d: Deal) => {
    navigate({ to: "/deals/$id", params: { id: d.id } });
  };

  return (
    <div>
      <PageHeader
        title="Negócios"
        description="Pipeline de vendas estilo HubSpot."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const ids = filtered.map((d) => d.id);
                if (!ids.length) return toast.error("Nenhum negócio para percorrer.");
                startFocusQueue("deals", ids, `Negócios · ${ids.length.toLocaleString("pt-BR")}`);
                toast.success(`Fila iniciada com ${ids.length} negócio(s)`);
                navigate({ to: "/deals/$id", params: { id: ids[0] } });
              }}
              disabled={filtered.length === 0}
              title="Percorrer todos os negócios do filtro atual, um a um"
            >
              <Play className="h-4 w-4 mr-1" /> Iniciar fila
            </Button>
            <Can permission="techsales.deals.create.own">
              <Button
                size="sm"
                onClick={openNew}
                className="bg-[color:var(--hs-orange)] text-[color:var(--hs-orange-foreground)] hover:bg-[color:var(--hs-orange)]/90"
              >
                <Plus className="h-4 w-4 mr-1" /> Criar negócio
              </Button>
            </Can>
          </div>
        }
      />

      <DealsToolbar
        pipelines={pipelines}
        selectedPipelineId={selectedId}
        onSelectPipeline={setSelectedId}
        owners={ownerOptions}
        filters={filters}
        setFilters={setFilters}
        focusMode={view === "board" ? focusMode : undefined}
        onToggleFocus={view === "board" ? setFocusMode : undefined}
        hotCount={boardHotCount}
        substatusOptions={substatuses}
      />

      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)} className="mt-4">
        <TabsList>
          <TabsTrigger value="table">
            <TableIcon className="h-3.5 w-3.5 mr-1" /> Tabela
          </TabsTrigger>
          <TabsTrigger value="board">
            <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Quadro
          </TabsTrigger>
          <TabsTrigger value="list">
            <ListIcon className="h-3.5 w-3.5 mr-1" /> Lista
          </TabsTrigger>
          <TabsTrigger value="forecast">
            <TrendingUp className="h-3.5 w-3.5 mr-1" /> Previsão
          </TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="mt-4">
          <DealsHubspotTable
            deals={filtered}
            pipeline={selected ?? undefined}
            lookups={lookups}
            onOpen={openEdit}
          />
        </TabsContent>
        <TabsContent value="board" className="mt-4">
          {selected ? (
            <DealsBoard
              pipeline={selected}
              deals={filtered}
              lookups={lookups}
              nextActivities={nextActivities}
              focusMode={focusMode}
              selectable
              canUpdate={canUpdateDeals}
              canDelete={canDeleteDeals}
              onOpen={openEdit}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Carregando pipeline…</p>
          )}
        </TabsContent>
        <TabsContent value="list" className="mt-4">
          {selected && (
            <DealsList pipeline={selected} deals={filtered} lookups={lookups} onOpen={openEdit} />
          )}
        </TabsContent>
        <TabsContent value="forecast" className="mt-4">
          {selected && <DealsForecast pipeline={selected} deals={filtered} />}
        </TabsContent>
      </Tabs>

      <DealDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        deal={editing}
        pipeline={selected}
        companies={companies}
        contacts={contacts}
        ownerId={user?.id}
      />
    </div>
  );
}
