import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  assertAttachmentDocumentAccess,
  assertContractDocumentAudience,
} from "./document-audience.server";

const contract = "50000000-0000-4000-8000-000000000001";
const attachment = "50000000-0000-4000-8000-000000000002";
const hash = "a".repeat(64);
function caller(data: unknown, error: { message: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}
describe("contract document audience boundary", () => {
  it("revalidates the exact contract and version before sharing cached bytes", async () => {
    const context = { audience: "supplier", content_hash: hash, attachments: [] };
    const { client, rpc } = caller(context);
    expect(await assertContractDocumentAudience(client, contract, hash)).toEqual(context);
    expect(rpc).toHaveBeenCalledWith("contract_attachment_audience_check", {
      p_contract: contract,
      p_hash: hash,
    });
  });
  it("does not allow missing or malformed audience decisions", async () => {
    for (const value of [
      null,
      {},
      { audience: "supplier", content_hash: "stale", attachments: [] },
    ])
      await expect(assertContractDocumentAudience(caller(value).client, contract)).rejects.toThrow(
        "indisponível",
      );
    await expect(
      assertContractDocumentAudience(
        caller({ audience: "client", content_hash: "b".repeat(64), attachments: [] }).client,
        contract,
        hash,
      ),
    ).rejects.toThrow("indisponível");
  });
  it("propagates live database denial instead of accepting a stored PDF", async () => {
    const { client } = caller(null, {
      message: "Sem permissão para o conteúdo comercial de compra.",
    });
    await expect(assertContractDocumentAudience(client, contract, hash)).rejects.toThrow(
      "Sem permissão",
    );
  });
  it("checks the attachment and parent before an internal download", async () => {
    const { client, rpc } = caller(true);
    await assertAttachmentDocumentAccess(client, contract, attachment);
    expect(rpc).toHaveBeenCalledWith("contract_attachment_access_check", {
      p_contract: contract,
      p_attachment: attachment,
    });
    await expect(
      assertAttachmentDocumentAccess(caller(false).client, contract, attachment),
    ).rejects.toThrow("Anexo indisponível");
  });
});
