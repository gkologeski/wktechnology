import { describe, it, expect } from "vitest";
import {
  withBasicLeadBlock,
  defaultBlockTitle,
  type QualificationFieldBlock,
} from "./field-layout";

describe("withBasicLeadBlock", () => {
  it("adiciona nome, sobrenome, e-mail, telefone e WhatsApp no topo", () => {
    const out = withBasicLeadBlock([]);
    expect(out[0].title).toBe("Dados básicos");
    expect(out[0].fields.map((f) => f.key)).toEqual([
      "first_name",
      "last_name",
      "email",
      "phone",
      "whatsapp_e164",
    ]);
  });

  it("não repete campo do lead já configurado no layout", () => {
    const layout: QualificationFieldBlock[] = [
      {
        id: "x",
        entity: "leads",
        position: "after",
        title: "Dados do Lead",
        fields: [{ key: "email", label: "E-mail", type: "text" }],
      },
    ];
    const keys = withBasicLeadBlock(layout)[0].fields.map((f) => f.key);
    expect(keys).not.toContain("email");
  });

  it("corrige o título 'Dados do Empresa'", () => {
    const out = withBasicLeadBlock([
      { id: "c", entity: "companies", position: "before", title: "Dados do Empresa", fields: [] },
    ]);
    expect(out[1].title).toBe("Dados da Empresa");
    expect(defaultBlockTitle("companies")).toBe("Dados da Empresa");
  });
});
