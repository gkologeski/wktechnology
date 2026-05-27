import { supabase } from "@/integrations/supabase/client";

export type LeadSource = {
  id: string;
  owner_id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export async function listLeadSources(activeOnly = true): Promise<LeadSource[]> {
  let q = supabase.from("lead_sources").select("*").order("name", { ascending: true });
  if (activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as LeadSource[];
}

export async function ensureLeadSource(ownerId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await supabase
    .from("lead_sources")
    .upsert({ owner_id: ownerId, name: trimmed, active: true }, { onConflict: "owner_id,name" });
}
