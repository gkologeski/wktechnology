// Modelos aprovados: a conta WhatsApp Business conectada é a fonte oficial.
// A tabela local `wa_templates` só é usada quando o conector não está configurado.
import { gatewayConfigured, listGatewayTemplates } from "./gateway-channel.server";

export type ApprovedTemplate = {
  name: string;
  language: string;
  status: string;
  components: unknown[];
};

export async function loadApprovedTemplates(
  supabase: any,
  workspaceId: string,
): Promise<ApprovedTemplate[]> {
  if (gatewayConfigured()) {
    const all = await listGatewayTemplates();
    return all
      .filter((t) => String(t.status).toUpperCase() === "APPROVED")
      .map((t) => ({
        name: t.name,
        language: t.language ?? "pt_BR",
        status: "APPROVED",
        components: t.components as unknown[],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  const { data, error } = await supabase
    .from("wa_templates")
    .select("name, language, status, components")
    .eq("workspace_id", workspaceId)
    .eq("status", "APPROVED")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ApprovedTemplate[];
}
