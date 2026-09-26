// Menu "N associações" do cartão da atividade: lista os registros associados
// agrupados por tipo, cada um com link para a página do registro.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

export type ActivityAssociationIds = {
  contacts: string[];
  companies: string[];
  deals: string[];
  leads: string[];
  tickets: string[];
};

type Kind = keyof ActivityAssociationIds;
type Item = { id: string; label: string };

const GROUPS: { kind: Kind; title: string; to: string }[] = [
  { kind: "contacts", title: "Contatos", to: "/contacts/$id" },
  { kind: "companies", title: "Empresas", to: "/companies/$id" },
  { kind: "deals", title: "Negócios", to: "/deals/$id" },
  { kind: "leads", title: "Leads", to: "/leads/$id" },
  { kind: "tickets", title: "Tickets", to: "/tickets/$id" },
];

const personName = (r: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) => [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || r.email || "Sem nome";

async function fetchNames(ids: ActivityAssociationIds): Promise<Record<Kind, Item[]>> {
  const out: Record<Kind, Item[]> = {
    contacts: [],
    companies: [],
    deals: [],
    leads: [],
    tickets: [],
  };
  const jobs: Promise<void>[] = [];
  if (ids.contacts.length)
    jobs.push(
      (async () => {
        const { data, error } = await supabase
          .from("contacts")
          .select("id, first_name, last_name, email")
          .in("id", ids.contacts);
        if (error) throw error;
        out.contacts = (data ?? []).map((r) => ({ id: r.id, label: personName(r) }));
      })(),
    );
  if (ids.leads.length)
    jobs.push(
      (async () => {
        const { data, error } = await supabase
          .from("leads")
          .select("id, first_name, last_name, email")
          .in("id", ids.leads);
        if (error) throw error;
        out.leads = (data ?? []).map((r) => ({ id: r.id, label: personName(r) }));
      })(),
    );
  if (ids.companies.length)
    jobs.push(
      (async () => {
        const { data, error } = await supabase
          .from("companies")
          .select("id, name")
          .in("id", ids.companies);
        if (error) throw error;
        out.companies = (data ?? []).map((r) => ({ id: r.id, label: r.name || "Sem nome" }));
      })(),
    );
  if (ids.deals.length)
    jobs.push(
      (async () => {
        const { data, error } = await supabase.from("deals").select("id, name").in("id", ids.deals);
        if (error) throw error;
        out.deals = (data ?? []).map((r) => ({ id: r.id, label: r.name || "Sem nome" }));
      })(),
    );
  if (ids.tickets.length)
    jobs.push(
      (async () => {
        const { data, error } = await supabase
          .from("tickets")
          .select("id, subject")
          .in("id", ids.tickets);
        if (error) throw error;
        out.tickets = (data ?? []).map((r) => ({ id: r.id, label: r.subject || "Sem assunto" }));
      })(),
    );
  await Promise.all(jobs);
  return out;
}

export function ActivityAssociationsMenu({
  activityId,
  ids,
}: {
  activityId: string;
  ids: ActivityAssociationIds;
}) {
  const [open, setOpen] = useState(false);
  const count = GROUPS.reduce((n, g) => n + ids[g.kind].length, 0);
  const q = useQuery({
    queryKey: ["activity-associations", activityId, ids],
    queryFn: () => fetchNames(ids),
    enabled: open && count > 0,
    staleTime: 60_000,
  });
  const label = `${count} ${count === 1 ? "associação" : "associações"}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs font-semibold text-primary hover:underline"
          aria-label={`Ver ${label}`}
        >
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        {count === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Sem associações.</p>
        ) : q.isLoading ? (
          <div
            className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground"
            aria-live="polite"
          >
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : q.isError ? (
          <div className="space-y-2 px-2 py-3">
            <p className="text-sm text-destructive">Não foi possível carregar as associações.</p>
            <Button size="sm" variant="outline" onClick={() => q.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {GROUPS.map((g) => {
              const items = q.data?.[g.kind] ?? [];
              if (!items.length) return null;
              return (
                <div key={g.kind}>
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.title} ({items.length})
                  </p>
                  <ul>
                    {items.map((it) => (
                      <li key={it.id}>
                        <Link
                          to={g.to}
                          params={{ id: it.id }}
                          onClick={() => setOpen(false)}
                          className="block truncate rounded px-2 py-1.5 text-sm text-primary hover:bg-muted hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {it.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
