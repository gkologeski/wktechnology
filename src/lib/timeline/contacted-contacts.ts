// Busca de contatos para o campo "Contatado" da timeline (RLS do workspace se aplica).
import { supabase } from "@/integrations/supabase/client";

export type ContactOption = { id: string; name: string; email: string | null };

type Row = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};
const toOption = (r: Row): ContactOption => ({
  id: r.id,
  name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email || "Contato sem nome",
  email: r.email,
});

export async function searchContactOptions(q: string): Promise<ContactOption[]> {
  let query = supabase.from("contacts").select("id, first_name, last_name, email").limit(10);
  const term = q.trim().replace(/[%,()]/g, " ");
  if (term)
    query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Row[]).map(toOption);
}

export async function fetchContactOptions(ids: string[]): Promise<ContactOption[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email")
    .in("id", ids);
  if (error) throw error;
  return ((data ?? []) as Row[]).map(toOption);
}
