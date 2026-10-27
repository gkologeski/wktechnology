import { cloudRequest, cloudList } from "./cloud-api.server";

/** Called only with the workspace resolved by the authenticated/job boundary. */
export async function resolveCloudNumber(workspaceId: string, phoneNumberId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const number = await admin
    .from("wa_cloud_numbers")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();
  if (number.error) throw new Error("Não foi possível verificar o número Meta.");
  if (!number.data) return null;
  const connection = await admin
    .from("wa_cloud_connections")
    .select("id,enabled,webhook_verified_at")
    .eq("id", number.data.connection_id)
    .eq("workspace_id", workspaceId)
    .single();
  if (
    connection.error ||
    !connection.data?.enabled ||
    !connection.data.webhook_verified_at ||
    !number.data.available
  )
    throw new Error("Conexão Meta indisponível ou ainda não ativada.");
  return {
    phoneNumberId,
    displayPhoneNumber: number.data.display_phone_number,
    workspaceId,
    connectionId: connection.data.id as string,
    provider: "cloud" as const,
  };
}

export async function cloudConnectionSecrets(workspaceId: string, connectionId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { decryptApiKey } = await import("@/lib/ai/provider-resolver.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("wa_cloud_connections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", connectionId)
    .single();
  if (error || !data?.enabled || !data.webhook_verified_at)
    throw new Error("Conexão Meta indisponível.");
  const secrets = JSON.parse(await decryptApiKey(data.credentials_ciphertext));
  return {
    ...data,
    credentials: {
      accessToken: secrets.accessToken as string,
      apiVersion: data.api_version as string,
    },
  };
}

export async function cloudTemplates(workspaceId: string, phoneNumberId: string) {
  const number = await resolveCloudNumber(workspaceId, phoneNumberId);
  if (!number) return null;
  const connection = await cloudConnectionSecrets(workspaceId, number.connectionId);
  return cloudList(
    connection.credentials,
    connection.waba_id,
    "message_templates",
    "id,name,language,status,category,components",
  );
}

export async function sendCloudPayload(workspaceId: string, phoneNumberId: string, body: any) {
  const number = await resolveCloudNumber(workspaceId, phoneNumberId);
  if (!number) throw new Error("Número não pertence a este workspace.");
  const connection = await cloudConnectionSecrets(workspaceId, number.connectionId);
  if (body.to && body.type === "template") {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { brPhoneVariants } = await import("./phone-variants");
    const optedOut = await supabaseAdmin
      .from("sdr_enrollments")
      .select("id")
      .eq("workspace_id", workspaceId)
      .in("contact_phone", brPhoneVariants(`+${String(body.to).replace(/\D/g, "")}`))
      .not("opted_out_at", "is", null)
      .limit(1);
    if (optedOut.error || optedOut.data?.length)
      throw new Error("Envio não permitido: descadastramento ou falha na verificação.");
  }
  if (body.type === "template") {
    const templates = await cloudList(
      connection.credentials,
      connection.waba_id,
      "message_templates",
      "name,language,status,components",
    );
    if (
      !templates.some(
        (template) =>
          template.name === body.template?.name &&
          template.language === body.template?.language?.code &&
          template.status === "APPROVED",
      )
    )
      throw new Error("Modelo não aprovado para a conta do número selecionado.");
    const phone = await cloudRequest(connection.credentials, phoneNumberId, "", {
      query: { fields: "id,quality_rating,status" },
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any)
      .from("wa_cloud_numbers")
      .update({
        quality_rating: phone.quality_rating ?? null,
        status: phone.status ?? null,
        synced_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId)
      .eq("phone_number_id", phoneNumberId);
    if (phone.quality_rating === "RED" || phone.status !== "CONNECTED")
      throw new Error(
        "Novos envios suspensos: verifique a qualidade e a situação do número na Meta.",
      );
  }
  const result = await cloudRequest(connection.credentials, phoneNumberId, "messages", {
    method: "POST",
    body,
  });
  if (!body.status && !result?.messages?.[0]?.id)
    throw new Error(
      "A Meta não confirmou o identificador do envio. Confira o histórico antes de reenviar.",
    );
  return result;
}

export async function downloadCloudMedia(
  workspaceId: string,
  phoneNumberId: string,
  mediaId: string,
) {
  const number = await resolveCloudNumber(workspaceId, phoneNumberId);
  if (!number) return null;
  const connection = await cloudConnectionSecrets(workspaceId, number.connectionId);
  const info = await cloudRequest(connection.credentials, mediaId, "", {
    query: { phone_number_id: phoneNumberId },
  });
  const url = new URL(info.url);
  const hosts = ["facebook.com", "fbcdn.net", "fbsbx.com", "whatsapp.net"];
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
  )
    throw new Error("Endereço de mídia Meta inválido.");
  if (info.file_size > 16 * 1024 * 1024) throw new Error("Mídia excede 16 MB.");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${connection.credentials.accessToken}` },
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Falha no download Meta (${response.status}).`);
  return { info, response };
}
