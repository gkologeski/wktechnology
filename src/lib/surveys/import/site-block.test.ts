import { describe, expect, it } from "vitest";
import {
  isBlockedStatus,
  isKnownBlockingUrl,
  isLoginRedirect,
  parseSiteBlocked,
  siteBlockedError,
} from "./site-block";

describe("site-block", () => {
  it("429, 403 e 999 são tratados como bloqueio", () => {
    expect(isBlockedStatus(429)).toBe(true);
    expect(isBlockedStatus(403)).toBe(true);
    expect(isBlockedStatus(999)).toBe(true);
    expect(isBlockedStatus(500)).toBe(false);
  });
  it("reconhece link de vaga do LinkedIn", () => {
    expect(isKnownBlockingUrl("https://www.linkedin.com/jobs/view/4462428582/")).toBe(true);
    expect(isKnownBlockingUrl("https://exemplo.com.br/vaga")).toBe(false);
  });
  it("redirecionamento para authwall é login", () => {
    expect(isLoginRedirect("https://www.linkedin.com/authwall?x=1")).toBe(true);
    expect(isLoginRedirect("https://exemplo.com/vagas/2")).toBe(false);
  });
  it("erro carrega o código e é reconhecido", () => {
    const p = parseSiteBlocked(siteBlockedError().message);
    expect(p.blocked).toBe(true);
    expect(p.text).toContain("bloqueia leitura automática");
  });
});
