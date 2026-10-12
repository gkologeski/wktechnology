/**
 * Aba "Nutrição" — lista leads com status `nurturing`, permitindo
 * acompanhar contatos que foram enviados para o funil de nutrição via
 * qualificação em /prospecting/queues/*.
 */
import { useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { orSafeLike } from "@/lib/postgrest-search";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, AtsSectionHeader } from "@/components/ats/ui";
import { Sprout, Search } from "lucide-react";

type NurturingLead = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  score: number | null;
  nurture_started_at: string | null;
  updated_at: string | null;
};

export function NurturingTab() {
  const [q, setQ] = useState("");

  const [page, setPage] = useState(0);
  const term = useDebouncedValue(q.trim(), 300);
  const PAGE = 50;

  // Paginação e busca no servidor (antes: 200 linhas fixas filtradas no navegador).
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["prospecting", "nurturing-leads", term, page],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select("id, first_name, last_name, email, phone, score, nurture_started_at, updated_at", {
          count: "exact",
        })
        .eq("status", "nurturing");
      if (term) {
        const like = orSafeLike(term);
        query = query.or(
          `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`,
        );
      }
      const { data, error, count } = await query
        .order("nurture_started_at", { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw new Error(error.message);
      return { rows: (data ?? []) as NurturingLead[], total: count ?? 0 };
    },
  });
  const filtered = data?.rows ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <AtsSectionHeader
        title="Leads em nutrição"
        description="Contatos enviados para o funil de nutrição após qualificação."
      />

      <div className="relative max-w-md">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Buscar por nome, e-mail ou telefone…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          aria-label="Buscar leads em nutrição"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={Sprout}
          title="Não foi possível carregar a nutrição"
          description={(error as Error).message}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title="Nenhum lead em nutrição"
          description="Ao enviar um lead para nutrição pela fila de prospecção, ele aparecerá aqui."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.map((l) => {
                const name = [l.first_name, l.last_name].filter(Boolean).join(" ") || "—";
                const started = l.nurture_started_at
                  ? new Date(l.nurture_started_at).toLocaleDateString("pt-BR")
                  : "—";
                return (
                  <Link
                    key={l.id}
                    to="/leads/$id"
                    params={{ id: l.id }}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {l.email ?? "—"} · {l.phone ?? "—"}
                      </div>
                    </div>
                    <div className="hidden md:block text-xs text-muted-foreground">
                      Em nutrição desde {started}
                    </div>
                    {typeof l.score === "number" ? (
                      <Badge variant="outline">score {l.score}</Badge>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      {total > PAGE && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {page * PAGE + 1}–{Math.min(total, (page + 1) * PAGE)} de{" "}
            {total.toLocaleString("pt-BR")}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(page + 1) * PAGE >= total}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
