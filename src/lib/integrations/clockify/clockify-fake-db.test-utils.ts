// Banco falso em memória para testar o motor do Clockify sem rede e sem Supabase.
// Implementa só o subconjunto do query builder usado pelo motor.
/* eslint-disable @typescript-eslint/no-explicit-any */

type Row = Record<string, any>;

function getPath(row: Row, path: string): any {
  // "payload->>userId", "payload->timeInterval->>start"
  const parts = path.split(/->>?/);
  let v: any = row;
  for (const p of parts) v = v == null ? undefined : v[p];
  return v;
}

let seq = 0;
export const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

const UNIQUE: Record<string, string[]> = {
  clockify_staging_records: ["workspace_id", "source_workspace_id", "entity_type", "external_id"],
  clockify_mappings: ["workspace_id", "source_workspace_id", "entity_type", "external_id"],
  clockify_import_links: ["workspace_id", "source_workspace_id", "entity_type", "external_id", "segment"],
};

class Query {
  private filters: Array<(r: Row) => boolean> = [];
  private orders: Array<{ col: string; asc: boolean }> = [];
  private from = 0;
  private to = Infinity;
  private op: "select" | "update" = "select";
  private patch: Row = {};
  private returning = false;
  private single: "maybe" | "one" | null = null;

  constructor(private db: FakeDb, private table: string) {}

  select(_cols?: string, _opts?: unknown) {
    this.returning = true;
    return this;
  }
  update(patch: Row) {
    this.op = "update";
    this.patch = patch;
    return this;
  }
  eq(col: string, v: any) {
    this.filters.push((r) => getPath(r, col) === v);
    return this;
  }
  neq(col: string, v: any) {
    this.filters.push((r) => getPath(r, col) !== v);
    return this;
  }
  gt(col: string, v: any) {
    this.filters.push((r) => getPath(r, col) > v);
    return this;
  }
  in(col: string, vs: any[]) {
    this.filters.push((r) => vs.includes(getPath(r, col)));
    return this;
  }
  not(col: string, _op: string, _v: null) {
    this.filters.push((r) => getPath(r, col) != null);
    return this;
  }
  ilike(col: string, term: string) {
    this.filters.push((r) => String(getPath(r, col) ?? "").toLowerCase() === term.toLowerCase());
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  range(a: number, b: number) {
    this.from = a;
    this.to = b;
    return this;
  }
  limit(n: number) {
    this.to = this.from + n - 1;
    return this;
  }
  maybeSingle() {
    this.single = "maybe";
    return this;
  }
  single_() {
    this.single = "one";
    return this;
  }

  private exec() {
    const rows = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);
    let hit = rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === "update") {
      for (const r of hit) Object.assign(r, structuredClone(this.patch));
      return { data: this.returning ? hit.map((r) => ({ ...r })) : null, error: null };
    }
    for (const o of [...this.orders].reverse()) {
      hit = [...hit].sort((x, y) => {
        const a = getPath(x, o.col) ?? "";
        const b = getPath(y, o.col) ?? "";
        return (a < b ? -1 : a > b ? 1 : 0) * (o.asc ? 1 : -1);
      });
    }
    const page = hit.slice(this.from, this.to + 1).map((r) => structuredClone(r));
    if (this.single) return { data: page[0] ?? null, error: null };
    return { data: page, error: null, count: hit.length };
  }

  then(resolve: (v: any) => void, reject?: (e: unknown) => void) {
    try {
      resolve(this.exec());
    } catch (e) {
      reject?.(e);
    }
  }
}

export class FakeDb {
  tables: Record<string, Row[]> = {};

  from(table: string) {
    const q = new Query(this, table) as any;
    q.upsert = (rows: Row[] | Row, _opts?: unknown) => {
      const list = Array.isArray(rows) ? rows : [rows];
      const t = (this.tables[table] ??= []);
      const keys = UNIQUE[table];
      for (const r of list) {
        const found = keys ? t.find((x) => keys.every((k) => x[k] === (r[k] ?? (k === "segment" ? 0 : undefined)))) : undefined;
        if (found) Object.assign(found, structuredClone(r));
        else t.push({ id: uuid(), status: table === "clockify_staging_records" ? "staged" : undefined, segment: 0, ...structuredClone(r) });
      }
      return Promise.resolve({ data: null, error: null });
    };
    q.insert = (rows: Row[] | Row) => {
      const list = Array.isArray(rows) ? rows : [rows];
      const t = (this.tables[table] ??= []);
      for (const r of list) t.push({ id: uuid(), ...structuredClone(r) });
      return Promise.resolve({ data: null, error: null });
    };
    return q;
  }

  /** Simula clockify_import_apply: grava linha a linha e devolve erro por linha. */
  rpc(name: string, args: { p_workspace: string; p_table: string; p_op: string; p_rows: Array<{ _key: string; id?: string; row: Row }> }) {
    if (name !== "clockify_import_apply") throw new Error(`rpc desconhecida ${name}`);
    const t = (this.tables[args.p_table] ??= []);
    const out = args.p_rows.map((r) => {
      const row = { ...r.row, workspace_id: args.p_workspace };
      if (args.p_table === "project_time_entries") {
        if (row.start_time && row.end_time) {
          const sec = (s: string) => s.split(":").reduce((a, x, i) => a + Number(x) * [3600, 60, 1][i], 0);
          row.duration_minutes = Math.round((sec(row.end_time) - sec(row.start_time)) / 60);
          const clash = t.find(
            (x) => x.id !== r.id && x.user_id === row.user_id && x.entry_date === row.entry_date && x.start_time && x.start_time < row.end_time && x.end_time > row.start_time,
          );
          if (clash) return { _key: r._key, error: `Já existe um apontamento entre ${clash.start_time} e ${clash.end_time} neste dia.` };
        }
        if (!(row.duration_minutes > 0)) return { _key: r._key, error: "hours_check" };
        row.hours = Math.round((row.duration_minutes / 60) * 100) / 100;
        row.source = "import";
      }
      if (args.p_op === "update") {
        const cur = t.find((x) => x.id === r.id);
        if (!cur) return { _key: r._key, error: "Registro de destino não encontrado." };
        Object.assign(cur, row);
        return { _key: r._key, id: cur.id };
      }
      if (args.p_table === "project_members") {
        const dup = t.find((x) => x.project_id === row.project_id && x.user_id === row.user_id);
        if (dup) return { _key: r._key, id: dup.id };
      }
      const id = uuid();
      t.push({ id, ...row });
      return { _key: r._key, id };
    });
    return Promise.resolve({ data: out, error: null });
  }
}
