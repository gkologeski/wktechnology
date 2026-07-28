/**
 * Aba "Nutrição" — lista leads com status `nurturing`, permitindo
 * acompanhar contatos que foram enviados para o funil de nutrição via
 * qualificação em /prospecting/queues/*.
 */
import { useMemo, useState } from "react";
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

  const { data, isLoading } = useQuery({
    queryKey: ["prospecting", "nurturing-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, first_name, last_name, email, phone, score, nurture_started_at, updated_at")
        .eq("status", "nurturing")
        .order("nurture_started_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as NurturingLead[];
    },
  });

  const filtered = useMemo(() => {
    const rows = data ?? [];
    if (!q.trim()) return rows;
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      const name = `${r.first_name ?? ""} ${r.last_name ?? ""}`.toLowerCase();
      return (
        name.includes(needle) ||
        (r.email ?? "").toLowerCase().includes(needle) ||
        (r.phone ?? "").toLowerCase().includes(needle)
      );
    });
  }, [data, q]);

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
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
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
    </div>
  );
}
