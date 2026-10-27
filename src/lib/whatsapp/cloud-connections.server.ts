import { cloudList, type MetaCredentials } from "./cloud-api.server";
import { assertSalesArea } from "@/lib/access-control/sales-core.server";

// Authorization is repeated immediately before the privileged credential access.
export async function authorizeCloudConnection(
  client: any,
  workspaceId: string,
  action: "view" | "manage",
) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth?.user?.id) throw new Error("Sessão inválida.");
  const member = await client.rpc("is_workspace_member", {
    _workspace: workspaceId,
    _user: auth.user.id,
  });
  if (member.error || member.data !== true) throw new Error("Membro ativo obrigatório.");
  const { data, error } = await client.rpc("user_has_permission", {
    _user_id: auth.user.id,
    _workspace_id: workspaceId,
    _permission_key: `system.whatsapp.${action}.workspace`,
  });
  if (error || data !== true)
    throw new Error("Sem permissão para gerenciar conexões deste workspace.");
  await assertSalesArea(client, "system.whatsapp", action);
}

export type CloudSecrets = MetaCredentials & { appSecret: string; verifyToken: string };

export async function inspectCloudNumbers(credentials: MetaCredentials, wabaId: string) {
  const numbers = await cloudList(
    credentials,
    wabaId,
    "phone_numbers",
    "id,display_phone_number,verified_name,quality_rating,status",
  );
  return numbers.map((number) => ({
    phone_number_id: String(number.id),
    display_phone_number: String(number.display_phone_number ?? ""),
    verified_name: number.verified_name ?? null,
    quality_rating: number.quality_rating ?? null,
    status: number.status ?? null,
  }));
}
