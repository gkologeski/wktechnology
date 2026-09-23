import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rest: { headers: new Headers() } },
}));

import { supabase } from "@/integrations/supabase/client";
import { beginAuditSession, endAuditSession } from "./audit-session";

const headers = (supabase as unknown as { rest: { headers: Headers } }).rest.headers;

afterEach(() => {
  headers.delete("x-audit-session");
});

describe("sessão de auditoria", () => {
  it("mantém a sessão do modal pai ao fechar um modal aninhado", () => {
    const parent = beginAuditSession();
    const child = beginAuditSession();
    expect(headers.get("x-audit-session")).toBe(child);
    endAuditSession(child);
    expect(headers.get("x-audit-session")).toBe(parent);
    endAuditSession(parent);
    expect(headers.has("x-audit-session")).toBe(false);
  });
});
