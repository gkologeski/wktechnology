import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Id do usuário autenticado (null enquanto carrega ou se não houver sessão). */
export function useCurrentUserId() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (alive) setUserId(data.user?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);
  return userId;
}
