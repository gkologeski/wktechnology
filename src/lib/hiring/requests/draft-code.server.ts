import { createHmac, randomInt, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";
import { emailSchema } from "@/lib/email-schema";
export function codeDigest(key: string, token: string, challenge: string, code: string) {
  return createHmac("sha256", key)
    .update(JSON.stringify(["hiring-draft-code-v1", token, challenge, code]))
    .digest("hex");
}
export async function requestDraftCode(
  sb: SupabaseClient,
  token: string,
  key: string,
  send: (to: string, code: string, id: string) => Promise<{ sent: boolean }>,
) {
  const challenge = randomUUID(),
    code = randomInt(10000000, 100000000).toString();
  const result = await workRpc<{ recipient: string }>(sb, "hiring_draft_code_reserve", {
    token,
    challenge,
    digest: codeDigest(key, token, challenge, code),
  });
  let sent = false;
  try {
    sent = (await send(emailSchema(255).parse(result.recipient), code, challenge)).sent;
  } catch {
    sent = false;
  }
  await workRpc(sb, "hiring_draft_code_delivery", { token, challenge, ok: sent });
  return { sent };
}
