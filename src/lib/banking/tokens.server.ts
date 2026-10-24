import { decryptApiKey, encryptApiKey } from "@/lib/ai/provider-resolver.server";
const prefix = "enc:v1:";
export async function sealBankToken(value: string | null) {
  return value === null ? null : prefix + (await encryptApiKey(value));
}
export async function openBankToken(value: string) {
  if (!value.startsWith(prefix))
    throw new Error("Credencial bancária legada: reautorize a conexão.");
  return decryptApiKey(value.slice(prefix.length));
}
