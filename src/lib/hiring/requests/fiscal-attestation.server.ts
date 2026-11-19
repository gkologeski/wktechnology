import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { FISCAL_MAX_BYTES, sniffFiscalMime } from "./operations-types";

/** Internal only: the authenticated handler supplies the path from its successful reservation RPC, never from user input. */
export async function attestReservedFiscalFile(input: {
  workspaceId: string;
  requestId: string;
  documentId: string;
  actorId: string;
  path: string;
  sha256: string;
  size: number;
  mime: string;
}): Promise<void> {
  const back = await supabaseAdmin.storage.from("hiring-fiscal-documents").download(input.path);
  if (back.error) throw new Error("Arquivo privado indisponível para confirmação.");
  const bytes = new Uint8Array(await back.data.arrayBuffer());
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
  if (
    bytes.length < 1 ||
    bytes.length > FISCAL_MAX_BYTES ||
    bytes.length !== input.size ||
    digest !== input.sha256 ||
    sniffFiscalMime(bytes) !== input.mime
  )
    throw new Error("Arquivo armazenado difere do enviado; envio interrompido.");
  await workRpc<void>(supabaseAdmin, "hiring_fiscal_attest", {
    w: input.workspaceId,
    i: input.requestId,
    p_doc: input.documentId,
    p_actor: input.actorId,
    p_sha256: digest,
    p_size: bytes.length,
    p_mime: input.mime,
  });
}
