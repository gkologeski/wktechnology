import { describe, expect, it } from "vitest";
import {
  buildAudience,
  fieldsForBase,
  isAllowedField,
  isAllowedFilter,
  normalizeCampaignPhone,
  type AudienceRow,
} from "./campaign-audience";

const row = (phone: string | null, values: AudienceRow["values"] = {}): AudienceRow => ({
  sourceType: "contact",
  sourceId: Math.random().toString(),
  contactId: null,
  phone,
  label: "x",
  values,
});

describe("público da campanha WhatsApp", () => {
  it("preenche variável pelo campo e usa o valor se vazio", () => {
    const s = buildAudience(
      [row("+5548991104003", { "contact.first_name": "Ana" }), row("+5511988887777", {})],
      { "1": { field: "contact.first_name", fallback: "tudo bem" } },
      new Set(),
    );
    expect(s.recipients.map((r) => r.variables["1"])).toEqual(["Ana", "tudo bem"]);
    expect(s.withMissing).toBe(0);
  });

  it("marca variável vazia sem valor se vazio", () => {
    const s = buildAudience(
      [row("+5511988887777")],
      { "1": { field: "contact.first_name" } },
      new Set(),
    );
    expect(s.withMissing).toBe(1);
    expect(s.recipients[0].missing).toEqual(["1"]);
  });

  it("exclui sem telefone, inválido, duplicado (com/sem 9º dígito) e descadastrado", () => {
    const s = buildAudience(
      [row(null), row("123"), row("+5548991104003"), row("+554891104003"), row("(11) 98888-7777")],
      {},
      new Set(["+5511988887777"]),
    );
    expect(s.excluded).toEqual({ no_phone: 1, invalid_phone: 1, duplicate: 1, opted_out: 1 });
    expect(s.recipients).toHaveLength(1);
  });

  it("normaliza número brasileiro sem DDI", () => {
    expect(normalizeCampaignPhone("48 99110-4003")).toBe("+5548991104003");
  });

  it("só aceita campos e filtros da lista branca de cada base", () => {
    expect(isAllowedField("contacts", "contact.first_name")).toBe(true);
    expect(isAllowedField("companies", "contact.email")).toBe(false);
    expect(isAllowedField("deals", "company.name")).toBe(true);
    expect(fieldsForBase("leads").some((f) => f.key.startsWith("deal."))).toBe(false);
    expect(isAllowedFilter("leads", { column: "hs_raw", op: "eq", value: "x" })).toBe(false);
    expect(isAllowedFilter("deals", { column: "stage", op: "eq", value: "won" })).toBe(true);
  });
});
