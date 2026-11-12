import { describe, expect, it } from "vitest";
import {
  friendlyLegalEntityError,
  LEGAL_ENTITY_REQUIRED_MESSAGE,
  pickInitialLegalEntity,
} from "./proposal-legal-entity";

const opts = [
  { id: "gm", name: "GM Kologeski", cnpj: null },
  { id: "cw", name: "CW Kologeski", cnpj: null },
];

describe("empresa emissora da proposta", () => {
  it("herda a empresa de origem ativa", () => {
    expect(pickInitialLegalEntity("cw", opts)).toEqual({ id: "cw", originInactive: false });
  });
  it("empresa de origem inativa fica vazia e avisa", () => {
    expect(pickInitialLegalEntity("wk", opts)).toEqual({ id: null, originInactive: true });
  });
  it("sem origem fica vazia sem aviso", () => {
    expect(pickInitialLegalEntity(null, opts)).toEqual({ id: null, originInactive: false });
  });
  it("erro do banco vira mensagem clara", () => {
    expect(
      friendlyLegalEntityError("Empresa (CNPJ) inativa, inexistente ou de outro workspace."),
    ).toBe(LEGAL_ENTITY_REQUIRED_MESSAGE);
    expect(friendlyLegalEntityError("outro erro")).toBe("outro erro");
  });
});

import { vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSalesRecord } from "@/lib/access-control/sales-core.server";

const PID = "00000000-0000-0000-0000-000000000002";
const authz = (data: unknown, message?: string) =>
  ({
    rpc: vi
      .fn()
      .mockResolvedValue(message ? { data: null, error: { message } } : { data, error: null }),
  }) as unknown as SupabaseClient;

describe("permissão de escolher a empresa emissora", () => {
  it("proposal legal entity permits an authorized active actor", async () => {
    await expect(assertSalesRecord(authz(true), "proposals", PID, "update")).resolves.not.toThrow();
  });
  it("proposal legal entity rejects missing permission", async () => {
    await expect(assertSalesRecord(authz(false), "proposals", PID, "update")).rejects.toThrow();
  });
  it("proposal legal entity rejects explicit deny", async () => {
    await expect(
      assertSalesRecord(authz(null, "explicit deny"), "proposals", PID, "update"),
    ).rejects.toThrow();
  });
  it("proposal legal entity rejects a foreign workspace", async () => {
    await expect(
      assertSalesRecord(authz(null, "foreign workspace"), "proposals", PID, "update"),
    ).rejects.toThrow();
  });
  it("proposal legal entity rejects inactive membership", async () => {
    await expect(
      assertSalesRecord(authz(null, "inactive membership"), "proposals", PID, "update"),
    ).rejects.toThrow();
  });
});
