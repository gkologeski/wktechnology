import { describe, expect, it } from "vitest";
import {
  distinctValues,
  isSuggestField,
  buildAudience,
  fieldsForBase,
  isAllowedField,
  isAllowedFilter,
  combineAudienceGroups,
  normalizeAudienceGroups,
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

  it("exclui sem telefone, inválido, duplicado  e descadastrado", () => {
    const s = buildAudience(
      [row(null), row("123"), row("+5548991104003"), row("+5548991104003"), row("(11) 98888-7777")],
      {},
      new Set(["+5511988887777"]),
    );
    expect(s.excluded).toEqual({
      no_phone: 1,
      invalid_phone: 1,
      landline: 0,
      duplicate: 1,
      opted_out: 1,
    });
    expect(s.recipients).toHaveLength(1);
  });

  it("exclui telefone fixo do público", () => {
    const s = buildAudience([row("(11) 3333-4444")], {}, new Set());
    expect(s.excluded.landline).toBe(1);
    expect(s.recipients).toHaveLength(0);
  });

  it("normaliza número brasileiro sem DDI", () => {
    expect(normalizeCampaignPhone("48 99110-4003")).toBe("+5548991104003");
  });

  it("só aceita campos e filtros da lista branca de cada base", () => {
    expect(isAllowedField("contacts", "contact.first_name")).toBe(true);
    expect(isAllowedField("companies", "contact.email")).toBe(true);
    expect(isAllowedField("deals", "company.name")).toBe(true);
    expect(fieldsForBase("leads").some((f) => f.key.startsWith("deal."))).toBe(true);
    expect(isAllowedFilter("leads", { column: "hs_raw", op: "eq", value: "x" })).toBe(false);
    expect(isAllowedFilter("deals", { column: "stage", op: "eq", value: "won" })).toBe(true);
  });
});

import {
  FREE_TEXT_FIELD as FREE,
  fieldsForBase as fieldsAll,
  isAllowedField as allowed,
  resolveVariables as resolveVars,
} from "./campaign-audience";

describe("variáveis livres e todas as entidades", () => {
  it("texto livre vai igual para todos, sem quebra de linha", () => {
    const r = resolveVars({}, { "1": { field: FREE, fallback: " Lia\nda WK " } });
    expect(r.variables["1"]).toBe("Lia da WK");
    expect(r.missing).toEqual([]);
  });
  it("texto livre vazio fica como variável faltando", () => {
    expect(resolveVars({}, { "1": { field: FREE, fallback: "  " } }).missing).toEqual(["1"]);
  });
  it("qualquer base oferece todas as entidades e responsáveis", () => {
    const keys = fieldsAll("companies").map((f) => f.key);
    for (const k of [
      "lead.first_name",
      "contact.first_name",
      "deal.name",
      "owner_company.full_name",
      "owner_deal.first_name",
      "sender.full_name",
    ])
      expect(keys).toContain(k);
  });
  it("campo fora da lista é recusado e texto livre é aceito", () => {
    expect(allowed("leads", "contact.cpf")).toBe(false);
    expect(allowed("leads", FREE)).toBe(true);
  });
});

describe("público em grupos E/OU", () => {
  const sets: Record<string, string[]> = { a: ["1", "2", "3"], b: ["2", "3", "4"], c: ["9"] };
  const idsFor = async (f: { column: string }) => new Set(sets[f.column]);
  const fl = (column: string) => ({ column, op: "eq" as const, value: "x" });

  it("E dentro do grupo faz intersecção", async () => {
    const r = await combineAudienceGroups([{ logic: "and", filters: [fl("a"), fl("b")] }], idsFor);
    expect([...r].sort()).toEqual(["2", "3"]);
  });
  it("OU entre grupos faz união", async () => {
    const r = await combineAudienceGroups(
      [
        { logic: "and", filters: [fl("a"), fl("b")] },
        { logic: "and", filters: [fl("c")] },
      ],
      idsFor,
    );
    expect([...r].sort()).toEqual(["2", "3", "9"]);
  });
  it("OU dentro do grupo faz união", async () => {
    const r = await combineAudienceGroups([{ logic: "or", filters: [fl("a"), fl("c")] }], idsFor);
    expect([...r].sort()).toEqual(["1", "2", "3", "9"]);
  });
  it("E entre grupos faz intersecção dos grupos", async () => {
    const r = await combineAudienceGroups(
      [
        { logic: "and", filters: [fl("a")] },
        { logic: "and", filters: [fl("b")] },
      ],
      idsFor,
      "and",
    );
    expect([...r].sort()).toEqual(["2", "3"]);
  });
  it("E entre grupos sem interseção resulta vazio", async () => {
    const r = await combineAudienceGroups(
      [
        { logic: "and", filters: [fl("a")] },
        { logic: "and", filters: [fl("c")] },
      ],
      idsFor,
      "and",
    );
    expect(r.size).toBe(0);
  });
  it("grupo vazio é ignorado e formato antigo vira um grupo E", () => {
    expect(normalizeAudienceGroups({ groups: [{ logic: "or", filters: [] }] })).toEqual([]);
    expect(normalizeAudienceGroups({ filters: [fl("a")] })).toEqual([
      { logic: "and", filters: [fl("a")] },
    ]);
  });
  it("valida campo de entidade relacionada pela lista branca", () => {
    expect(
      isAllowedFilter("contacts", {
        entity: "companies",
        column: "industry",
        op: "ilike",
        value: "soft",
      }),
    ).toBe(true);
    expect(
      isAllowedFilter("contacts", { entity: "companies", column: "secret", op: "eq", value: "x" }),
    ).toBe(false);
    expect(isAllowedFilter("deals", { column: "stage", op: "ilike", value: "won" })).toBe(false);
    expect(isAllowedFilter("deals", { column: "stage", op: "is_null", value: "" })).toBe(true);
  });
});

describe("valores conhecidos dos filtros", () => {
  it("Setor de empresas tem lista; campo fora da lista não", () => {
    expect(isSuggestField("companies", "industry")).toBe(true);
    expect(isSuggestField("companies", "name")).toBe(false);
  });
  it("remove vazios e repetidos sem diferenciar maiúsculas", () => {
    expect(distinctValues(["TI", " ti ", "", null, "Saúde"])).toEqual(["Saúde", "TI"]);
  });
});

describe("filtros com catálogo completo", () => {
  const cat = [
    { name: "email", label: "E-mail", type: "text" as const },
    { name: "amount", label: "Valor", type: "currency" as const },
    { name: "is_active", label: "Ativo", type: "boolean" as const },
    { name: "company_id", label: "Empresa", type: "text" as const, ref: "company" },
    { name: "mobile_digits", label: "x", type: "text" as const },
    { name: "portal_token", label: "x", type: "text" as const },
  ];
  const deals = buildFilterFields("deals", cat, [{ key: "nps", label: "NPS" }]);
  const fields = { ...FILTER_FIELDS, deals };
  it("inclui campos do catálogo e personalizados", () => {
    expect(deals.find((d) => d.column === "email")?.kind).toBe("text");
    expect(deals.find((d) => d.column === "amount")?.kind).toBe("number");
    expect(deals.some((d) => d.column === "cf:nps")).toBe(true);
  });
  it("exclui referências não-usuário, *_digits e tokens", () => {
    expect(deals.some((d) => ["company_id", "mobile_digits", "portal_token"].includes(d.column))).toBe(false);
  });
  it("aceita campo do catálogo e recusa fora dele", () => {
    expect(isAllowedFilter("deals", { column: "amount", op: "gte", value: "1000" }, fields)).toBe(true);
    expect(isAllowedFilter("deals", { column: "inexistente", op: "eq", value: "x" }, fields)).toBe(false);
    expect(isAllowedFilter("deals", { column: "mobile_digits", op: "eq", value: "1" }, fields)).toBe(false);
  });
  it("recusa operador incompatível e valor inválido", () => {
    expect(isAllowedFilter("deals", { column: "amount", op: "ilike", value: "1" }, fields)).toBe(false);
    expect(isAllowedFilter("deals", { column: "amount", op: "gte", value: "abc" }, fields)).toBe(false);
    expect(isAllowedFilter("deals", { column: "is_active", op: "eq", value: "talvez" }, fields)).toBe(false);
  });
  it("campo personalizado vira caminho JSON", () => {
    expect(filterColumnPath("cf:nps")).toBe("custom_fields->>nps");
    expect(() => filterColumnPath("cf:a;drop")).toThrow();
  });
  it("filtro antigo continua válido na lista padrão", () => {
    expect(isAllowedFilter("companies", { column: "industry", op: "ilike", value: "soft" })).toBe(true);
  });
});
