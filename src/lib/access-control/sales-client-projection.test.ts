import { describe, expect, it } from "vitest";
import { salesPublicSelection } from "./sales-client-projection";

describe("user-side projection compatibility with private column ACLs", () => {
  it("preserves commercial numeric columns and removes explicit/aliased tokens", () => {
    const selected = salesPublicSelection(
      "quotes",
      "id,total,tax_total,public_token,link:public_token,hidden:public_token::text",
    );
    expect(selected).toBe("id,total,tax_total");
    expect(salesPublicSelection("quotes", "*")).toContain("discount_total");
    expect(salesPublicSelection("quotes", "*")).not.toContain("public_token");
  });
  it("expands protected relations recursively through aliases and FK hints", () => {
    const selected = salesPublicSelection(
      "deals",
      "id,q:quotes!deal_id(*,person:contacts(id,first_name,portal_token))",
    );
    expect(selected).toContain("q:quotes!deal_id(id,owner_id");
    expect(selected).toContain("person:contacts(id,first_name)");
    expect(selected).not.toMatch(/public_token|portal_token/);
  });
  it("does not modify unprotected scalar functions or ordinary projections", () => {
    expect(salesPublicSelection("deals", "id,name,activities(count())")).toBe(
      "id,name,activities(count())",
    );
  });
});
