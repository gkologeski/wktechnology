import { describe, expect, it } from "vitest";
import {
  buildProposalEmail,
  defaultProposalMessage,
  defaultProposalSubject,
} from "./proposal-email";

describe("e-mail da proposta", () => {
  it("assunto usa a empresa quando existe", () => {
    expect(defaultProposalSubject("P1", "ÓGEA")).toBe("Proposta comercial — ÓGEA");
    expect(defaultProposalSubject("P1", null)).toBe("Proposta comercial — P1");
  });
  it("saudação usa o primeiro nome do contato", () => {
    expect(defaultProposalMessage("Alan Fuentes")).toMatch(/^Olá, Alan, tudo bem\?/);
  });
  it("corpo inclui o link de aprovação e escapa HTML", () => {
    const r = buildProposalEmail({
      title: "x",
      company: null,
      contact: null,
      link: "https://app/proposal/abc",
      message: "<b>oi</b>",
    });
    expect(r.html).toContain('href="https://app/proposal/abc"');
    expect(r.html).not.toContain("<b>oi</b>");
    expect(r.text).toContain("https://app/proposal/abc");
  });
});

import { vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSalesAnyArea } from "@/lib/access-control/sales-core.server";

const authz = (data: unknown, message?: string) =>
  ({
    rpc: vi
      .fn()
      .mockResolvedValue(message ? { data: null, error: { message } } : { data, error: null }),
  }) as unknown as SupabaseClient;

describe("permissão de envio da proposta", () => {
  it("proposal send permits an authorized active actor", async () => {
    const c = authz({ workspace: "w", actor: "a" });
    await assertSalesAnyArea(c, "techsales.proposal_send", "manage");
    expect(c.rpc).toHaveBeenCalledWith("sales_area_authorize", {
      r: "techsales.proposal_send",
      a: "manage",
      t: null,
      i: null,
    });
  });
  it("proposal send rejects missing permission", async () => {
    await expect(
      assertSalesAnyArea(authz(null, "missing permission"), "techsales.proposal_send", "manage"),
    ).rejects.toThrow("missing permission");
  });
  it("proposal send rejects explicit deny", async () => {
    await expect(
      assertSalesAnyArea(authz(null, "explicit deny"), "techsales.proposal_send", "manage"),
    ).rejects.toThrow("explicit deny");
  });
  it("proposal send rejects a foreign workspace", async () => {
    await expect(
      assertSalesAnyArea(authz(null, "foreign workspace"), "techsales.proposal_send", "manage"),
    ).rejects.toThrow("foreign workspace");
  });
  it("proposal send rejects inactive membership", async () => {
    await expect(
      assertSalesAnyArea(authz(null, "inactive membership"), "techsales.proposal_send", "manage"),
    ).rejects.toThrow("inactive membership");
  });
});
