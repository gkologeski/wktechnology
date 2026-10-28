import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { assertSalesView } from "./finance-sales.server";

const WS = "184b9435-0a9b-4334-9e89-8854dc883f5d";
const OTHER = "11111111-1111-4111-8111-111111111111";
const USER = "00000000-0000-4000-8000-000000000001";

/** Simula finance_sales_access no banco por cenário. */
const client = (allowed: (a: Record<string, string>) => boolean, error: unknown = null) =>
  ({
    rpc: vi.fn(async (_fn: string, a: Record<string, string>) => ({
      data: error ? null : allowed(a),
      error,
    })),
  }) as unknown as SupabaseClient;

describe("vendas importadas — fronteira de acesso", () => {
  it("permite membro ativo com a permissão de ver vendas", async () => {
    await expect(
      assertSalesView(
        client((a) => a["p_ws"] === WS),
        WS,
        USER,
      ),
    ).resolves.toBeUndefined();
  });
  it("nega quem não tem a permissão de ver vendas", async () => {
    await expect(
      assertSalesView(
        client(() => false),
        WS,
        USER,
      ),
    ).rejects.toThrow(/Sem permissão/);
  });
  it("nega quando há bloqueio explícito (deny) nas vendas", async () => {
    await expect(
      assertSalesView(
        client(() => true, { message: "denied" }),
        WS,
        USER,
      ),
    ).rejects.toThrow(/Sem permissão/);
  });
  it("nega vendas de outro workspace", async () => {
    await expect(
      assertSalesView(
        client((a) => a["p_ws"] === WS),
        OTHER,
        USER,
      ),
    ).rejects.toThrow(/Sem permissão/);
  });
  it("nega vendas a membro inativo", async () => {
    const inactive = new Set([USER]);
    await expect(
      assertSalesView(
        client((a) => !inactive.has(a["p_user"]!)),
        WS,
        USER,
      ),
    ).rejects.toThrow(/Sem permissão/);
  });
});
