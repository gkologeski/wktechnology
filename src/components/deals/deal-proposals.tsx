// Lista de propostas vinculadas ao negócio (somente leitura, RLS do usuário).
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/crm";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovada",
  sent: "Enviada",
  accepted: "Aceita",
  rejected: "Recusada",
  expired: "Expirada",
  canceled: "Cancelada",
};

export function DealProposals({ dealId }: { dealId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["deal-proposals", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("id, title, status, total_amount, currency, version")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <div className="h-12 animate-pulse rounded-md bg-muted" />;
  if (error) return <p className="text-sm text-destructive">Não foi possível carregar as propostas.</p>;
  if (!data?.length)
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma proposta. Use "Gerar proposta" em uma cotação acima.
      </p>
    );

  return (
    <div className="space-y-2">
      {data.map((p) => (
        <Link
          key={p.id}
          to="/proposals/$id"
          params={{ id: p.id }}
          className="block rounded-md border p-3 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="font-semibold text-primary truncate">{p.title || "Proposta"}</div>
          <div className="mt-1 text-xs text-muted-foreground tabular-nums">
            {STATUS_LABEL[p.status] ?? p.status} · v{p.version}
            {p.total_amount != null && ` · ${formatCurrency(Number(p.total_amount), p.currency)}`}
          </div>
        </Link>
      ))}
    </div>
  );
}
