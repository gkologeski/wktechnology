import { describe, expect, it } from "vitest";
import { canReadWholeWorkspace, classifyAccess, suggestSourceId } from "./clockify-access";

const A = "64a687e29ae1f428e7ebe303";
const B = "64a687e29ae1f428e7ebe304";

describe("classifyAccess", () => {
  it("proprietário vem do filtro OWNER", () => {
    expect(classifyAccess(A, new Set([A]), new Set())).toBe("owner");
  });
  it("administrador vem do filtro WORKSPACE_ADMIN", () => {
    expect(classifyAccess(A.toUpperCase(), new Set(), new Set([A]))).toBe("admin");
  });
  it("fora dos dois filtros = sem acesso administrativo", () => {
    expect(classifyAccess(B, new Set([A]), new Set([A]))).toBe("not_admin");
  });
  it("filtro indisponível nunca presume admin", () => {
    expect(classifyAccess(B, null, new Set([A]))).toBe("unknown");
    expect(classifyAccess(B, new Set(), null)).toBe("unknown");
  });
});

describe("canReadWholeWorkspace", () => {
  it("libera só proprietário e administrador", () => {
    expect(canReadWholeWorkspace("owner")).toBe(true);
    expect(canReadWholeWorkspace("admin")).toBe(true);
    expect(canReadWholeWorkspace("not_admin")).toBe(false);
    expect(canReadWholeWorkspace("unknown")).toBe(false);
    expect(canReadWholeWorkspace(null)).toBe(false);
  });
});

describe("suggestSourceId", () => {
  const list = [
    { id: A, name: "WK Technology" },
    { id: B, name: "Outro" },
  ];
  it("sugere o único com nome igual ao do ERP (sem diferenciar caixa/acentos)", () => {
    expect(suggestSourceId(list, "wk  technology")).toBe(A);
  });
  it("não sugere quando há nomes repetidos", () => {
    expect(suggestSourceId([...list, { id: "x", name: "WK Technology" }], "WK Technology")).toBe(
      null,
    );
  });
  it("não sugere sem correspondência", () => {
    expect(suggestSourceId(list, "Outra empresa")).toBe(null);
  });
});
