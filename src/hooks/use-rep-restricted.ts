import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "@/hooks/use-current-user-id";

/** Usuário com cargo de visibilidade restrita (ex.: Representante de Vendas externa). */
export function useRepRestricted() {
  const q = useQuery({
    queryKey: ["rep-is-restricted"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rep_is_restricted");
      if (error) return false;
      return data === true;
    },
  });
  return { restricted: q.data === true, isLoading: q.isLoading };
}

/**
 * Registro "vinculado": o usuário restrito o vê por estar ligado a um lead/negócio
 * dele, mas não é o responsável nem o criador. Mostra só a ficha resumida.
 */
export function useIsLinkedOnly(
  row: { owner_id?: string | null; assigned_to?: string | null } | null | undefined,
) {
  const { restricted, isLoading } = useRepRestricted();
  const userId = useCurrentUserId();
  if (!row || isLoading || !restricted || !userId) return false;
  return row.owner_id !== userId && row.assigned_to !== userId;
}
