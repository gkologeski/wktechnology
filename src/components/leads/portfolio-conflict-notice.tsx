import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "@/hooks/use-current-user-id";

/**
 * Aviso (não bloqueia): a empresa escolhida já está na carteira de outra pessoa.
 * O responsável é notificado ao salvar o lead.
 */
export function PortfolioConflictNotice({ companyId }: { companyId: string | null }) {
  const userId = useCurrentUserId();
  const { data } = useQuery({
    queryKey: ["company-portfolio-owner", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.rpc("company_portfolio_owner", { _company_id: companyId! });
      return Array.isArray(data) ? (data[0] ?? null) : null;
    },
  });
  if (!companyId || !data?.owner_id || !userId || data.owner_id === userId) return null;
  return (
    <p
      role="status"
      aria-live="polite"
      className="flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5 text-[11px] text-foreground"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
      <span>
        Esta empresa já está na carteira de <strong>{data.owner_name ?? "outro vendedor"}</strong>.
        Você pode criar o lead; o responsável será avisado.
      </span>
    </p>
  );
}
