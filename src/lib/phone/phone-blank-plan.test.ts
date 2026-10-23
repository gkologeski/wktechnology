import { describe, expect, it } from "vitest";
import { planBlankShort } from "../../../scripts/phone-e164/blank-short";
import { applyBatchSql } from "../../../scripts/phone-e164/batch-sql";

const WS = "184b9435-0a9b-4334-9e89-8854dc883f5d";
const RUN = "11111111-1111-4111-8111-111111111111";
const row = (t: string, c: string, id: string, v: string, extra: Record<string, unknown> = {}) => ({
  t,
  c,
  id,
  v,
  ...extra,
});
const open = (id: string, t: string, rowId: string, c: string, original: string) => ({
  id,
  t,
  rowId,
  c,
  original,
  cls: "too_short",
});

describe("prévia da limpeza até 4 dígitos", () => {
  it("apaga 0–4 dígitos, mantém 5 e não toca no fixo/celular válidos do mesmo registro", () => {
    const rows = [
      row("contacts", "mobile_phone", "a", "1234"),
      row("contacts", "phone", "a", "+551133334444"),
      row("contacts", "mobile_phone", "b", "12345"),
      row("contacts", "mobile_phone", "c", "--"),
      row("contacts", "phone", "d", "+5511999998888"),
      row("contacts", "mobile_phone", "d", "7"),
    ];
    const { items } = planBlankShort(rows, [
      open("1", "contacts", "a", "mobile_phone", "1234"),
      open("2", "contacts", "b", "mobile_phone", "12345"),
      open("3", "contacts", "d", "mobile_phone", "7"),
    ]);
    const blank = items.filter((i) => i.cls === "blank_short").map((i) => `${i.id}.${i.c}`);
    expect(blank.sort()).toEqual(["a.mobile_phone", "c.mobile_phone", "d.mobile_phone"]);
    expect(items.every((i) => i.proposed === null || i.cls !== "blank_short")).toBe(true);
    expect(items.find((i) => i.c === "phone")).toBeUndefined();
  });

  it("ramal não infla o comprimento", () => {
    const { items } = planBlankShort([row("contacts", "phone", "a", "1234 ramal 98765")], []);
    expect(items).toMatchObject([{ cls: "blank_short", proposed: null }]);
  });

  it("valor alterado desde a varredura não entra na prévia", () => {
    const { items, resolutions } = planBlankShort(
      [row("contacts", "mobile_phone", "a", "+5511988887777")],
      [open("9", "contacts", "a", "mobile_phone", "7")],
    );
    expect(items).toHaveLength(0);
    expect(resolutions).toHaveLength(0);
  });

  it("DDI repetido só aplica com país do próprio registro", () => {
    const v = "+55 55 11 3333-4444";
    const withCountry = planBlankShort(
      [row("companies", "phone", "a", v, { country: "Brasil" })],
      [open("1", "companies", "a", "phone", v)],
    );
    expect(withCountry.items).toMatchObject([
      { cls: "safe_record_country", proposed: "+551133334444" },
    ]);
    const without = planBlankShort(
      [row("companies", "phone", "a", v)],
      [open("1", "companies", "a", "phone", v)],
    );
    expect(without.items).toHaveLength(0);
    expect(without.reasons[0].reason).toMatch(/repetido/);
  });

  it("celular antigo sem 9 fica pendente com candidato mascarado, nunca aplicado", () => {
    const v = "(51) 9301-6927";
    const r = planBlankShort(
      [row("contacts", "mobile_phone", "a", v, { country: "Brasil" })],
      [open("1", "contacts", "a", "mobile_phone", v)],
    );
    expect(r.items).toHaveLength(0);
    expect(r.reasons[0].reason).toMatch(/sem o 9º dígito/);
    expect(r.reasons[0].reason).not.toContain("93016927");
  });

  it("número fixo/especial não é gravado no campo Celular", () => {
    const v = "+55 55 11 3333-4444";
    const r = planBlankShort(
      [row("contacts", "mobile_phone", "a", v, { country: "Brasil" })],
      [open("1", "contacts", "a", "mobile_phone", v)],
    );
    expect(r.items).toHaveLength(0);
    expect(r.reasons[0].reason).toMatch(/não é celular/);
  });

  it("duplicidade entre leads fica para revisão", () => {
    const v = "+55 55 11 3333-4444";
    const r = planBlankShort(
      [
        row("leads", "phone", "a", v, { country: "Brasil" }),
        row("leads", "phone", "b", "+551133334444"),
      ],
      [open("1", "leads", "a", "phone", v)],
    );
    // Leads não têm país no export: sem evidência, também não aplica.
    expect(r.items).toHaveLength(0);
  });
});

describe("SQL do lote", () => {
  it("compara o original, filtra o workspace e não apaga ramal", () => {
    const sql = applyBatchSql({
      run: RUN,
      parent: null,
      ws: WS,
      table: "contacts",
      col: "phone",
    });
    expect(sql).toContain("x.phone is not distinct from b.original_value");
    expect(sql).toContain(`x.workspace_id = '${WS}'`);
    expect(sql).toContain("phone_ext = coalesce(x.phone_ext, b.proposed_ext)");
    expect(sql).toContain("i.applied_at is null");
  });
  it("recusa campo fora do inventário e uuid inválido", () => {
    expect(() =>
      applyBatchSql({ run: RUN, parent: null, ws: WS, table: "contacts", col: "hs_raw" }),
    ).toThrow();
    expect(() =>
      applyBatchSql({ run: "x'; drop", parent: null, ws: WS, table: "contacts", col: "phone" }),
    ).toThrow();
  });
});
