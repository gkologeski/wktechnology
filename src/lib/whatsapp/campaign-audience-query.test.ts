import { describe, expect, it } from "vitest";
import { compileAudienceGroups } from "./campaign-audience";
import {
  loadAudienceRows,
  loadOptedOutPhones,
  loadRecentWhatsAppSends,
} from "./campaign-audience.server";

type Row = Record<string, unknown>;

/** Banco falso: devolve `rows[tabela]` respeitando `.in`, `.range` e o teto de 1.000 da API. */
function fakeDb(rows: Record<string, Row[]>, rpcResult: unknown = []) {
  const calls: { table: string; ops: string[] }[] = [];
  const rpcCalls: { fn: string; args: Row }[] = [];
  const from = (table: string) => {
    const call = { table, ops: [] as string[] };
    calls.push(call);
    let data = [...(rows[table] ?? [])];
    let range: [number, number] | null = null;
    const q: Record<string, unknown> = {};
    const chain =
      (name: string, fn?: (...a: unknown[]) => void) =>
      (...a: unknown[]) => {
        call.ops.push(name);
        fn?.(...a);
        return q;
      };
    Object.assign(q, {
      select: chain("select"),
      eq: chain("eq"),
      neq: chain("neq"),
      is: chain("is"),
      not: chain("not"),
      gte: chain("gte"),
      order: chain("order"),
      limit: chain("limit"),
      in: chain("in", (col, vals) => {
        data = data.filter((r) => (vals as unknown[]).includes(r[col as string]));
      }),
      range: chain("range", (a, b) => {
        range = [a as number, b as number];
      }),
      then: (resolve: (v: unknown) => unknown) => {
        const page = range ? data.slice(range[0], range[1] + 1) : data;
        return Promise.resolve({ data: page.slice(0, 1000), error: null }).then(resolve);
      },
    });
    return q;
  };
  const rpc = async (fn: string, args: Row) => {
    rpcCalls.push({ fn, args });
    return { data: rpcResult, error: null };
  };
  return { db: { from, rpc }, calls, rpcCalls };
}

describe("público da campanha WhatsApp — consulta no banco", () => {
  it("limpa curingas dos termos de 'contém' e 'não contém' como antes", () => {
    const [g] = compileAudienceGroups("contacts", [
      {
        logic: "and",
        filters: [
          { column: "cargo_resumido", op: "ilike", value: "", values: ["CIO", "50%_off*"] },
          { entity: "companies", column: "industry", op: "not_ilike", value: "a,b(c)" },
        ],
      },
    ]);
    expect(g.filters[0]).toMatchObject({
      entity: "contacts",
      column: "cargo_resumido",
      terms: ["CIO", "50  off"],
    });
    expect(g.filters[1]).toMatchObject({ entity: "companies", terms: ["a b c"] });
  });

  it("'é diferente de' usa o valor limpo; 'é igual a' mantém o valor digitado", () => {
    const [g] = compileAudienceGroups("leads", [
      {
        logic: "or",
        filters: [
          { column: "status", op: "neq", value: " x,y " },
          { column: "status", op: "eq", value: " new " },
        ],
      },
    ]);
    expect(g.logic).toBe("or");
    expect(g.filters[0].value).toBe("x y");
    expect(g.filters[1].value).toBe("new");
  });

  it("campo personalizado vai como chave separada e chave inválida é recusada", () => {
    const [g] = compileAudienceGroups("contacts", [
      { logic: "and", filters: [{ column: "cf:segmento", op: "eq", value: "TI" }] },
    ]);
    expect(g.filters[0]).toMatchObject({ column: null, custom_key: "segmento" });
    expect(() =>
      compileAudienceGroups("contacts", [
        { logic: "and", filters: [{ column: "cf:x;drop", op: "eq", value: "1" }] },
      ]),
    ).toThrow();
  });

  it("resolve os filtros numa única chamada ao banco, sem ler cada filtro em páginas", async () => {
    const contacts = [
      { id: "c1", first_name: "Ana", whatsapp_e164: "+5548991104003" },
      { id: "c2", first_name: "Bia", whatsapp_e164: "+5511988887777" },
    ];
    const { db, calls, rpcCalls } = fakeDb({ contacts }, ["c1", "c2"]);
    const r = await loadAudienceRows(db, "ws", {
      type: "filter",
      base: "contacts",
      groups: [{ logic: "and", filters: [{ column: "job_title", op: "ilike", value: "CIO" }] }],
    });
    expect(rpcCalls.map((c) => c.fn)).toEqual(["wa_campaign_audience_ids"]);
    expect(rpcCalls[0].args).toMatchObject({ p_base: "contacts", p_limit: 5001 });
    expect(r.rows.map((x) => x.sourceId).sort()).toEqual(["c1", "c2"]);
    // Nenhuma leitura paginada da base por filtro (o caminho antigo usava .range).
    expect(calls.some((c) => c.table === "contacts" && c.ops.includes("range"))).toBe(false);
  });

  it("envios recentes não são cortados em 1.000 linhas", async () => {
    const recipients = Array.from({ length: 1484 }, (_, i) => ({
      id: `r${String(i).padStart(5, "0")}`,
      phone: `+55489${String(91100000 + i)}`,
      sent_at: "2026-10-30T12:00:00Z",
    }));
    const { db } = fakeDb({ whatsapp_campaign_recipients: recipients });
    const recent = await loadRecentWhatsAppSends(db, "ws", "2026-10-01T00:00:00Z");
    expect(recent.size).toBe(1484);
  });

  it("opt-outs não são cortados em 1.000 linhas", async () => {
    const rows = Array.from({ length: 1200 }, (_, i) => ({
      id: `e${String(i).padStart(5, "0")}`,
      contact_phone: `+55489${String(91100000 + i)}`,
    }));
    const { db } = fakeDb({ sdr_enrollments: rows });
    expect((await loadOptedOutPhones(db, "ws")).size).toBe(1200);
  });
});
