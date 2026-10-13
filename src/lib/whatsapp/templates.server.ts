// Modelos aprovados: a conta WhatsApp Business conectada é a fonte oficial.
// A tabela local `wa_templates` só é usada quando o conector não está configurado.
import { gatewayConfigured, listGatewayTemplates } from "./gateway-channel.server";

export type ApprovedTemplate = {
  name: string;
  language: string;
  status: string;
  components: unknown[];
};

export type TemplateCatalog = {
  /** Origem real do catálogo (conta conectada × tabela local). */
  source: "provider" | "local";
  items: ApprovedTemplate[];
};

export async function loadTemplateCatalog(
  supabase: any,
  workspaceId: string,
  opts: { language?: string | null } = {},
): Promise<TemplateCatalog> {
  const lang = opts.language?.trim() || null;
  if (gatewayConfigured()) {
    const all = await listGatewayTemplates();
    const items = all
      .filter((t) => String(t.status).toUpperCase() === "APPROVED")
      .map((t) => ({
        name: t.name,
        language: t.language ?? "pt_BR",
        status: "APPROVED",
        components: (t.components ?? []) as unknown[],
      }))
      .filter((t) => !lang || t.language === lang)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { source: "provider", items };
  }
  let q = supabase
    .from("wa_templates")
    .select("name, language, status, components")
    .eq("workspace_id", workspaceId)
    .eq("status", "APPROVED")
    .order("name", { ascending: true });
  if (lang) q = q.eq("language", lang);
  const { data, error } = await q;
  if (error) throw error;
  return { source: "local", items: (data ?? []) as ApprovedTemplate[] };
}

export async function loadApprovedTemplates(
  supabase: any,
  workspaceId: string,
  opts: { language?: string | null } = {},
): Promise<ApprovedTemplate[]> {
  return (await loadTemplateCatalog(supabase, workspaceId, opts)).items;
}
