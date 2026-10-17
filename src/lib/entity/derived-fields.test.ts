import { describe, expect, it } from "vitest";
import { isDerivedCrmField } from "./derived-fields";
import { buildBulkPayload } from "../grid/bulk-edit-fields";
import { fieldsForBase } from "../whatsapp/campaign-audience";
describe("database-owned CRM fields", () => {
  for (const field of ["cargo_resumido", "area_atuacao", "nivel_hierarquico", "size_description"]) {
    it(`rejects bulk edits to ${field}`, () => {
      expect(isDerivedCrmField(field)).toBe(true);
      expect(() => buildBulkPayload({ [field]: "forged" }, new Map([[field, "text"]]))).toThrow();
    });
  }
  it("keeps original Cargo editable and permits explicit clear", () => {
    expect(buildBulkPayload({ job_title: null }, new Map([["job_title", "text"]]))).toEqual({
      job_title: null,
    });
  });
  it("offers derived values as campaign variables", () => {
    const keys = fieldsForBase("leads").map((f) => f.key);
    expect(keys).toContain("lead.cargo_resumido");
    expect(keys).toContain("contact.area_atuacao");
    expect(keys).toContain("company.size_description");
  });
});
