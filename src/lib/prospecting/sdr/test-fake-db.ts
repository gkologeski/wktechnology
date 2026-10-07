// Banco em memória para testes do SDR (somente testes). Imita o cliente de
// consulta usado nos módulos (from/select/eq/in/update/insert/upsert/rpc) e as
// funções SQL do SDR com a mesma semântica de compare-and-set.
/* eslint-disable @typescript-eslint/no-explicit-any */

type Row = Record<string, any>;
let seq = 0;
const uid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

class Query {
  private filters: ((r: Row) => boolean)[] = [];
  private op: "select" | "update" | "insert" | "upsert" | "delete" = "select";
  private payload: any = null;
  private opts: any = {};
  private returning = false;
  private mode: "one" | "maybe" | null = null;
  private limitN: number | null = null;
  private orderBy: { col: string; asc: boolean } | null = null;
  private head = false;
  constructor(
    private db: FakeDb,
    private table: string,
  ) {}
  select(_cols?: string, o?: { count?: string; head?: boolean }) {
    if (this.op === "select") this.op = "select";
    else this.returning = true;
    if (o?.head) this.head = true;
    return this;
  }
  eq(c: string, v: any) {
    this.filters.push((r) => r[c] === v);
    return this;
  }
  neq(c: string, v: any) {
    this.filters.push((r) => r[c] !== v);
    return this;
  }
  is(c: string, v: any) {
    this.filters.push((r) => (r[c] ?? null) === v);
    return this;
  }
  in(c: string, vs: any[]) {
    this.filters.push((r) => vs.includes(r[c]));
    return this;
  }
  lte(c: string, v: any) {
    this.filters.push((r) => r[c] != null && r[c] <= v);
    return this;
  }
  gte(c: string, v: any) {
    this.filters.push((r) => r[c] != null && r[c] >= v);
    return this;
  }
  not(c: string, op: string, v: string | null) {
    if (op === "is") {
      this.filters.push((r) => (r[c] ?? null) !== v);
      return this;
    }
    const list = String(v).replace(/[()]/g, "").split(",");
    this.filters.push((r) => !list.includes(String(r[c])));
    return this;
  }
  contains(c: string, sub: Record<string, unknown>) {
    this.filters.push((r) => {
      const o = (r[c] ?? {}) as Record<string, unknown>;
      return Object.entries(sub).every(([k, val]) => o[k] === val);
    });
    return this;
  }
  order(col: string, o?: { ascending?: boolean }) {
    this.orderBy = { col, asc: o?.ascending !== false };
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }

  singleRow() {
    this.mode = "one";
    return this;
  }
  update(p: Row) {
    this.op = "update";
    this.payload = p;
    return this;
  }
  insert(p: Row | Row[]) {
    this.op = "insert";
    this.payload = p;
    return this;
  }
  upsert(p: Row | Row[], o?: any) {
    this.op = "upsert";
    this.payload = p;
    this.opts = o ?? {};
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  then(res: (v: any) => void, rej?: (e: any) => void) {
    try {
      res(this.exec());
    } catch (e) {
      rej?.(e);
    }
  }
  private rows() {
    return (this.db.tables[this.table] ??= []);
  }
  private exec(): { data: any; error: any; count?: number } {
    const all = this.rows();
    const match = () => all.filter((r) => this.filters.every((f) => f(r)));
    let out: Row[] = [];
    if (this.op === "select") {
      out = match();
      if (this.head) return { data: null, error: null, count: out.length };
    } else if (this.op === "update") {
      out = match();
      for (const r of out) Object.assign(r, this.payload);
    } else if (this.op === "delete") {
      out = match();
      this.db.tables[this.table] = all.filter((r) => !out.includes(r));
    } else {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload];
      for (const p of list) {
        const keys: string[] = this.opts.onConflict ? String(this.opts.onConflict).split(",") : [];
        const existing = keys.length ? all.find((r) => keys.every((k) => r[k] === p[k])) : null;
        if (existing) {
          if (this.op === "insert")
            return { data: null, error: { code: "23505", message: "duplicate" } };
          if (!this.opts.ignoreDuplicates) {
            Object.assign(existing, p);
            out.push(existing);
          }
          continue;
        }
        const unique = this.db.unique[this.table];
        if (unique && all.some((r) => unique.every((k) => r[k] === p[k])))
          return { data: null, error: { code: "23505", message: "duplicate" } };
        const row = { id: uid(), created_at: new Date().toISOString(), ...p };
        all.push(row);
        out.push(row);
      }
    }
    if (this.orderBy) {
      const { col, asc } = this.orderBy;
      out = [...out].sort(
        (a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1),
      );
    }
    if (this.limitN != null) out = out.slice(0, this.limitN);
    const copy = out.map((r) => ({ ...r }));
    if (this.mode === "maybe") return { data: copy[0] ?? null, error: null };
    if (this.mode === "one")
      return copy[0]
        ? { data: copy[0], error: null }
        : { data: null, error: { message: "no rows" } };
    if ((this.op === "update" || this.op === "insert" || this.op === "upsert") && !this.returning)
      return { data: null, error: null };
    return { data: copy, error: null };
  }
}

export class FakeDb {
  tables: Record<string, Row[]> = {};
  unique: Record<string, string[]> = {};
  /** Ganchos para simular eventos concorrentes. */
  hooks: { beforeCommit?: () => void } = {};

  from(table: string) {
    const q = new Query(this, table) as any;
    // Supabase usa .single(); o nome conflita com o campo interno.
    q.single = function () {
      return q.singleRow();
    };
    return q;
  }
  t(name: string) {
    return (this.tables[name] ??= []);
  }
  find(name: string, id: string) {
    return this.t(name).find((r) => r.id === id);
  }

  async rpc(fn: string, a: any): Promise<{ data: any; error: any }> {
    const now = new Date().toISOString();
    if (fn === "sdr_set_conversation_owner") {
      const c = this.find("whatsapp_conversations", a.p_conversation);
      if (!c) return { data: null, error: null };
      c.ai_owner = a.p_owner;
      c.ai_version = (c.ai_version ?? 0) + 1;
      for (const j of this.t("sdr_turn_jobs"))
        if (j.conversation_id === c.id && ["queued", "running", "drafted"].includes(j.status)) {
          j.status = "discarded";
          j.lease_token = null;
        }
      return { data: null, error: null };
    }
    if (fn === "sdr_claim_jobs") {
      const claimed: Row[] = [];
      const jobs = [...this.t("sdr_turn_jobs")].sort((x, y) =>
        x.created_at > y.created_at ? 1 : -1,
      );
      const seen = new Set<string>();
      for (const j of jobs) {
        if (claimed.length >= a.p_limit) break;
        if (seen.has(j.conversation_id)) continue;
        const free =
          (j.status === "queued" && (!j.lease_until || j.lease_until < now)) ||
          (j.status === "running" && j.lease_until < now);
        if (!free || (j.attempts ?? 0) >= 3) continue;
        seen.add(j.conversation_id);
        const busy = this.t("sdr_turn_jobs").some(
          (r) =>
            r.conversation_id === j.conversation_id &&
            r.id !== j.id &&
            r.status === "running" &&
            r.lease_until >= now,
        );
        if (busy) continue;
        Object.assign(j, {
          status: "running",
          lease_token: uid(),
          lease_until: new Date(Date.now() + a.p_lease_seconds * 1000).toISOString(),
          attempts: (j.attempts ?? 0) + 1,
        });
        claimed.push({ ...j });
      }
      return { data: claimed, error: null };
    }
    if (fn === "sdr_guard" || fn === "sdr_commit_turn") {
      const reason = this.check(a.p_job, a.p_lease);
      if (fn === "sdr_guard" || reason !== "ok") return { data: reason, error: null };
      this.hooks.beforeCommit?.();
      const again = this.check(a.p_job, a.p_lease);
      if (again !== "ok") return { data: again, error: null };
      return { data: this.commit(a), error: null };
    }
    if (fn === "sdr_reserve_send_quota") {
      // Espelha 0069: conta wamids únicos de sucesso em 24 h + reservas ativas alheias.
      const j = this.find("sdr_turn_jobs", a.p_job);
      if (!j || j.status !== "running" || j.lease_token !== a.p_lease)
        return { data: { result: "lease_lost" }, error: null };
      const since = new Date(Date.now() - 86400_000).toISOString();
      const used = new Set(
        this.t("sdr_actions")
          .filter(
            (x) =>
              x.workspace_id === j.workspace_id &&
              x.kind === "message_sent" &&
              x.status === "success" &&
              x.provider_ref &&
              (x.created_at ?? now) >= since,
          )
          .map((x) => x.provider_ref),
      ).size;
      const reserved = this.t("sdr_turn_jobs").filter(
        (t) =>
          t.workspace_id === j.workspace_id &&
          t.id !== j.id &&
          ["running", "sent"].includes(t.status) &&
          t.send_reserved_until > now &&
          !this.t("sdr_actions").some(
            (x) => x.job_id === t.id && x.kind === "message_sent" && x.status === "success",
          ),
      ).length;
      if (j.send_reserved_until > now)
        return { data: { result: "already_reserved", used, reserved }, error: null };
      if (used + reserved >= a.p_limit)
        return { data: { result: "daily_limit", used, reserved, limit: a.p_limit }, error: null };
      j.send_reserved_until = new Date(Date.now() + 90_000).toISOString();
      return { data: { result: "ok", used, reserved: reserved + 1 }, error: null };
    }
    throw new Error(`rpc não simulada: ${fn}`);
  }

  private check(jobId: string, lease: string): string {
    const j = this.find("sdr_turn_jobs", jobId);
    if (!j) return "job_missing";
    if (j.status !== "running" || j.lease_token !== lease) return "lease_lost";
    const c = this.find("whatsapp_conversations", j.conversation_id);
    if (!c || c.workspace_id !== j.workspace_id) return "context_mismatch";
    if (c.ai_owner !== "ai") return "owner_not_ai";
    if (c.ai_version !== j.conversation_version) return "stale_version";
    const e = this.find("sdr_enrollments", j.enrollment_id);
    if (!e || e.workspace_id !== j.workspace_id) return "context_mismatch";
    if (e.status !== "active") return "enrollment_inactive";
    return "ok";
  }

  private commit(a: any): string {
    const j = this.find("sdr_turn_jobs", a.p_job)!;
    const e = this.find("sdr_enrollments", j.enrollment_id)!;
    const q = a.p_qualification;
    if (q) {
      let row = q.id ? this.find("prospecting_qualifications", q.id) : null;
      if (q.id && !row) return "qualification_missing";
      if (
        row &&
        (row.updated_at !== q.expected_updated_at ||
          JSON.stringify(row.answers ?? {}) !== JSON.stringify(q.expected_answers ?? {}))
      )
        return "qualification_changed";
      if (
        !row &&
        this.t("prospecting_qualifications").some(
          (r) =>
            r.workspace_id === j.workspace_id &&
            r.questionnaire_id === q.questionnaire_id &&
            r.entity === q.entity &&
            r.entity_id === q.entity_id,
        )
      )
        return "qualification_changed";
      if (!row) {
        row = {
          id: uid(),
          workspace_id: j.workspace_id,
          questionnaire_id: q.questionnaire_id,
          entity: q.entity,
          entity_id: q.entity_id,
          decision: "pending",
        };
        this.t("prospecting_qualifications").push(row);
      }
      Object.assign(row, {
        answers: q.answers,
        score: Math.round(q.score),
        questionnaire_points: q.questionnaire_points,
        icp_points: q.icp_points,
        total_score: q.total_score,
        updated_at: new Date().toISOString(),
      });
      e.qualification_id = row.id;
      e.qualification_score = Math.round(q.total_score);
    }
    for (const ev of a.p_evidence ?? []) {
      const m = this.find("whatsapp_messages", ev.message_id);
      if (!m || m.conversation_id !== j.conversation_id || m.direction !== "inbound") continue;
      this.t("sdr_qualification_evidence").push({
        id: uid(),
        workspace_id: j.workspace_id,
        enrollment_id: e.id,
        ...ev,
      });
    }
    if (a.p_enrollment) Object.assign(e, a.p_enrollment);
    if (a.p_job_patch) {
      Object.assign(j, a.p_job_patch);
      if ((a.p_job_patch.status ?? "running") !== "running") j.lease_token = null;
    }
    return "ok";
  }
}
