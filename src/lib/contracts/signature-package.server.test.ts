import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  query: vi.fn(),
  from: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
}));
vi.mock("@/lib/access-control/work-core.server", () => ({ workRpc: mocks.rpc }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: mocks.from,
    storage: { from: () => ({ upload: mocks.upload, download: mocks.download }) },
  },
}));
import { prepareSignaturePackage } from "./signature-package.server";

const CONTRACT = "40000000-0000-4000-8000-000000000001",
  HASH = "a".repeat(64);
const sb = {} as SupabaseClient;
const attachment = {
  id: "file",
  kind: "file",
  name: "Proposta técnica.pdf",
  source_id: null,
  storage_path: "workspace/contract/file",
  source_snapshot_path: null,
  source_snapshot_sha256: null,
  stamp: "b".repeat(64),
};
const cached = {
  id: "cached",
  workspace_id: "workspace",
  contract_id: CONTRACT,
  contract_hash: HASH,
  storage_path: "private/cached.pdf",
  sha256: "c".repeat(64),
  manifest: [attachment],
  page_count: 8,
};
beforeEach(() => {
  vi.resetAllMocks();
  const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: mocks.query };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  mocks.from.mockReturnValue(chain);
  mocks.query.mockResolvedValue({ data: cached, error: null });
  mocks.rpc.mockImplementation(async (_sb: unknown, name: string) => {
    if (name === "contract_attachment_audience_check")
      return {
        audience: "supplier",
        content_hash: HASH,
        attachments: [{ id: "file", audience: "supplier", commercial_sensitive: true }],
      };
    if (name === "contract_attachment_signing_context")
      return { workspace_id: "workspace", body: "Contrato compra", attachments: [attachment] };
    throw new Error("Unexpected RPC " + name);
  });
});
it("cached signature package revalidates current audience and record after private lookup", async () => {
  expect(await prepareSignaturePackage(sb, "actor", CONTRACT, HASH)).toEqual(cached);
  expect(mocks.rpc.mock.calls.map((call) => call[1])).toEqual([
    "contract_attachment_audience_check",
    "contract_attachment_signing_context",
    "contract_attachment_audience_check",
    "contract_attachment_signing_context",
  ]);
  expect(mocks.upload).not.toHaveBeenCalled();
  expect(mocks.download).not.toHaveBeenCalled();
});
it("revoked economic permission after lookup prevents cached package disclosure", async () => {
  let calls = 0;
  mocks.rpc.mockImplementation(async (_sb: unknown, name: string) => {
    if (name === "contract_attachment_audience_check") {
      if (++calls === 2) throw new Error("Sem permissão para conteúdo comercial de compra.");
      return { audience: "supplier", content_hash: HASH, attachments: [] };
    }
    return { workspace_id: "workspace", body: "Compra", attachments: [attachment] };
  });
  await expect(prepareSignaturePackage(sb, "actor", CONTRACT, HASH)).rejects.toThrow(
    "Sem permissão",
  );
  expect(mocks.query).toHaveBeenCalledTimes(1);
  expect(mocks.download).not.toHaveBeenCalled();
});
it("changed contract hash after cache lookup rejects the stale PDF", async () => {
  let calls = 0;
  mocks.rpc.mockImplementation(async (_sb: unknown, name: string) =>
    name === "contract_attachment_audience_check"
      ? {
          audience: "supplier",
          content_hash: ++calls === 1 ? HASH : "d".repeat(64),
          attachments: [],
        }
      : { workspace_id: "workspace", body: "Compra", attachments: [attachment] },
  );
  await expect(prepareSignaturePackage(sb, "actor", CONTRACT, HASH)).rejects.toThrow(
    "público dos anexos indisponível",
  );
  expect(mocks.query).toHaveBeenCalledTimes(1);
  expect(mocks.download).not.toHaveBeenCalled();
});
it("no external attachments returns null before any private package query", async () => {
  mocks.rpc.mockImplementation(async (_sb: unknown, name: string) =>
    name === "contract_attachment_audience_check"
      ? { audience: "supplier", content_hash: HASH, attachments: [] }
      : { workspace_id: "workspace", body: "Compra", attachments: [] },
  );
  expect(await prepareSignaturePackage(sb, "actor", CONTRACT, HASH)).toBeNull();
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
});
