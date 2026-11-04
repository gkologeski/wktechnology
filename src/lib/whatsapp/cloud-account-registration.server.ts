import { authorizeCloudConnection, type CloudSecrets } from "./cloud-connections.server";
import { metaObjectId, MetaCloudError } from "./cloud-api.server";

type Registration = {
  workspaceId: string;
  userId: string;
  sourceId: string;
  wabaId: string;
  label: string;
};

type Services = {
  decrypt: (ciphertext: string) => Promise<string>;
  encrypt: (plaintext: string) => Promise<string>;
  inspect: (credentials: CloudSecrets, wabaId: string) => Promise<unknown[]>;
};

/** Existing credentials stay on the server; a new WABA must independently accept them. */
export async function registerCloudAccount(
  client: any,
  admin: any,
  input: Registration,
  services: Services,
) {
  metaObjectId(input.wabaId);
  await authorizeCloudConnection(client, input.workspaceId, "manage");
  const source = await admin
    .from("wa_cloud_connections")
    .select("id,workspace_id,api_version,credentials_ciphertext")
    .eq("id", input.sourceId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();
  if (source.error || !source.data || source.data.workspace_id !== input.workspaceId)
    throw new Error("Conexão de origem indisponível neste workspace.");
  await authorizeCloudConnection(client, input.workspaceId, "manage");
  let saved: { accessToken?: unknown; appSecret?: unknown };
  try {
    saved = JSON.parse(await services.decrypt(source.data.credentials_ciphertext));
  } catch {
    throw new Error("Não foi possível ler as credenciais da conexão de origem.");
  }
  if (
    !saved ||
    typeof saved.accessToken !== "string" ||
    typeof saved.appSecret !== "string" ||
    !saved.accessToken ||
    !saved.appSecret
  )
    throw new Error("Credenciais da conexão de origem incompletas.");
  const secrets: CloudSecrets = {
    accessToken: saved.accessToken,
    appSecret: saved.appSecret,
    apiVersion: source.data.api_version,
    verifyToken: Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
      v.toString(16).padStart(2, "0"),
    ).join(""),
  };
  let numbers: unknown[];
  try {
    numbers = await services.inspect(secrets, input.wabaId);
  } catch (error) {
    if (error instanceof MetaCloudError) throw error;
    throw new Error("Não foi possível validar o acesso a esta conta na Meta.");
  }
  if (!numbers.length) throw new Error("A Meta não retornou números para esta conta.");
  // Permission revocation during the remote lookup prevents persistence as well.
  await authorizeCloudConnection(client, input.workspaceId, "manage");
  let credentials: string;
  try {
    credentials = await services.encrypt(
      JSON.stringify({
        accessToken: secrets.accessToken,
        appSecret: secrets.appSecret,
        verifyToken: secrets.verifyToken,
      }),
    );
  } catch {
    throw new Error("Não foi possível proteger as credenciais da nova conta.");
  }
  const result = await admin
    .from("wa_cloud_connections")
    .insert({
      workspace_id: input.workspaceId,
      label: input.label,
      waba_id: input.wabaId,
      api_version: secrets.apiVersion,
      credentials_ciphertext: credentials,
      created_by: input.userId,
      enabled: false,
    })
    .select("id")
    .single();
  if (result.error || !result.data?.id)
    throw new Error("Não foi possível cadastrar a conta. Confira se ela já está cadastrada.");
  return { id: String(result.data.id) };
}

/** Fixed server-configured origin; callers cannot redirect verification secrets. */
export function cloudAccountCallback(connectionId: string, origin: string) {
  if (!/^[a-f0-9-]{36}$/i.test(connectionId)) throw new Error("Conexão inválida.");
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("O webhook da Meta exige uma origem pública HTTPS.");
  return `${url.origin}/api/public/whatsapp/cloud/${connectionId}`;
}

export function cloudAccountSubscription(
  connectionId: string,
  origin: string,
  verifyToken: string,
) {
  if (typeof verifyToken !== "string" || verifyToken.length < 32)
    throw new Error("Verificação da conexão incompleta.");
  return {
    method: "POST" as const,
    body: {
      override_callback_uri: cloudAccountCallback(connectionId, origin),
      verify_token: verifyToken,
    },
  };
}
