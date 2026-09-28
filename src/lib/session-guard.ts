// Evita chamar server functions protegidas sem sessão (ex.: durante o logout).
// Falha no próprio navegador, sem gerar erro 401 no servidor.
import { supabase } from "@/integrations/supabase/client";

export async function withClientSession<T>(call: () => Promise<T>): Promise<T> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sessão encerrada. Entre novamente.");
  return call();
}
