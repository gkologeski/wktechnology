// Fases 4/5 — guarda de envio multicanal com provedores falsos (sem envio real).
import { describe, expect, it } from "vitest";
import {
  backoffMs,
  classifyFailure,
  nextSendSlot,
  type SendPolicy,
} from "./engine/delivery-policy";
import { guardedDelivery, stableDeliveryKey } from "./engine/delivery-guard.server";
import type { RunCtx, RunnableAction } from "./engine/run-context";
import type { LogStep } from "./engine-shared.server";

type Row = {
  key: string;
  channel: string;
  recipient: string | null;
  status: string;
  attempts: number;
  lease: number;
  created: number;
  provider_id?: string | null;
  last_error?: string | null;
};

/** Banco falso: reproduz `workflow_delivery_claim/finish` e os históricos de canal. */
function fakeDb(opts: {
  policy?: Partial<SendPolicy> | null;
  waHistory?: string[];
  clock: () => number;
}) {
  const rows = new Map<string, Row>();
  const policy = opts.policy ?? null;
  const sb = {
    rows,
    from(table: string) {
      const filters: [string, unknown][] = [];
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => (filters.push([k, v]), q),
        not: () => q,
        limit: async () => {
          if (table === "whatsapp_messages") {
            const key = filters.find(([k]) => k === "raw->source->>idempotency_key")?.[1];
            return {
              data: (opts.waHistory ?? []).includes(key as string)
                ? [{ id: "wa-1", wa_message_id: "wamid.X" }]
                : [],
            };
          }
          return { data: [] };
        },
        maybeSingle: async () => ({
          data:
            table === "workflow_send_policies" && policy
              ? {
                  weekdays: [],
                  window_start: null,
                  window_end: null,
                  timezone: "America/Sao_Paulo",
                  dedupe_hours: 0,
                  whatsapp_daily_limit: null,
                  email_daily_limit: null,
                  ...policy,
                }
              : null,
        }),
      };
      return q;
    },
    async rpc(fn: string, a: Record<string, unknown>) {
      const now = opts.clock();
      if (fn === "workflow_delivery_finish") {
        const r = rows.get(a.p_key as string);
        if (r && (r.status === "in_flight" || r.status === "uncertain")) {
          r.status = a.p_status as string;
          r.provider_id = (a.p_provider_id as string) ?? r.provider_id;
          r.last_error = a.p_error as string;
          r.lease = 0;
        }
        return { data: null, error: null };
      }
      const key = a.p_key as string;
      const r = rows.get(key);
      const max = a.p_max_attempts as number;
      if (r) {
        if (r.status === "sent" || r.status === "deduped")
          return { data: { result: "already_sent", provider_id: r.provider_id }, error: null };
        if (r.status === "uncertain") return { data: { result: "uncertain" }, error: null };
        if (r.status === "in_flight") {
          if (r.lease > now) return { data: { result: "in_flight" }, error: null };
          r.status = "uncertain";
          return { data: { result: "uncertain" }, error: null };
        }
        if (r.status === "failed" || r.attempts >= max)
          return {
            data: { result: "exhausted", attempts: r.attempts, error: r.last_error },
            error: null,
          };
        r.status = "in_flight";
        r.attempts += 1;
        r.lease = now + 120_000;
        return { data: { result: "claimed", attempts: r.attempts }, error: null };
      }
      const ch = a.p_channel as string;
      const rec = a.p_recipient as string | null;
      if (
        policy?.dedupe_hours &&
        rec &&
        [...rows.values()].some(
          (x) =>
            x.channel === ch &&
            x.recipient === rec &&
            ["sent", "in_flight", "uncertain"].includes(x.status) &&
            x.created > now - policy.dedupe_hours! * 3_600_000,
        )
      ) {
        rows.set(key, {
          key,
          channel: ch,
          recipient: rec,
          status: "deduped",
          attempts: 0,
          lease: 0,
          created: now,
        });
        return { data: { result: "deduped" }, error: null };
      }
      const lim = ch === "whatsapp" ? policy?.whatsapp_daily_limit : policy?.email_daily_limit;
      if (lim != null) {
        const used = [...rows.values()].filter(
          (x) =>
            x.channel === ch &&
            ["sent", "in_flight", "uncertain", "retry_scheduled"].includes(x.status),
        ).length;
        if (used >= lim) return { data: { result: "quota", used, limit: lim }, error: null };
      }
      rows.set(key, {
        key,
        channel: ch,
        recipient: rec,
        status: "in_flight",
        attempts: 1,
        lease: now + 120_000,
        created: now,
      });
      return { data: { result: "claimed", attempts: 1 }, error: null };
    },
  };
  return sb;
}

const wa: RunnableAction = {
  type: "send_whatsapp",
  template_name: "mensagem001",
  to_field: "phone",
} as RunnableAction;
const email: RunnableAction = {
  type: "send_email",
  to_field: "email",
  subject: "Oi",
  body: "x",
} as RunnableAction;
const ctx = (runId = "run-1", phone = "5511999990000"): RunCtx => ({
  entity: "leads",
  entityId: "lead-1",
  ownerId: "u1",
  workspaceId: "ws-wk",
  after: { phone, email: "a@b.com" },
  before: null,
  workflowId: "wf-1",
  runId,
});
const okSend =
  (count: { n: number }, id = "wamid.1") =>
  async (): Promise<LogStep> => {
    count.n++;
    return {
      at: "",
      ok: true,
      action: "send_whatsapp",
      delivery: {
        channel: "whatsapp",
        provider: "meta",
        provider_status: "accepted",
        provider_id: id,
        workflow_id: null,
        run_id: null,
        agent_id: null,
        agent_version_id: null,
      },
    };
  };

describe("guarda de envio (fases 4/5)", () => {
  it("reprocessar o mesmo passo não envia duas vezes", async () => {
    let t = 0;
    const db = fakeDb({ clock: () => t });
    const c = ctx();
    const n = { n: 0 };
    await guardedDelivery(db as never, wa, c, "1", okSend(n));
    const second = await guardedDelivery(db as never, wa, c, "1", okSend(n));
    expect(n.n).toBe(1);
    expect(second.delivery?.provider_status).toBe("skipped_duplicate");
    t++;
  });

  it("chave estável sobrevive à retomada (estado do run)", () => {
    const c = ctx("run-A");
    const k = stableDeliveryKey(c, "2.par:1.1");
    const resumed = { ...ctx("run-B"), state: c.state };
    expect(stableDeliveryKey(resumed, "2.par:1.1")).toBe(k);
  });

  it("dois processos simultâneos: o segundo vê envio em andamento e espera", async () => {
    const db = fakeDb({ clock: () => 0 });
    const n = { n: 0 };
    let release!: () => void;
    const slow = () =>
      new Promise<LogStep>(
        (r) => (release = () => r({ at: "", ok: true, action: "send_whatsapp" })),
      );
    const first = guardedDelivery(db as never, wa, ctx(), "1", async () => (n.n++, slow()));
    await new Promise((r) => setTimeout(r, 0));
    const other = await guardedDelivery(db as never, wa, ctx(), "1", okSend(n));
    expect(other.delivery?.provider_status).toBe("in_flight");
    expect(other.suspend_until).toBeTruthy();
    release();
    await first;
    expect(n.n).toBe(1);
  });

  it("429 agenda nova tentativa com espera crescente e depois envia", async () => {
    let t = 1_000;
    const db = fakeDb({ clock: () => t });
    const c = ctx();
    const fail = async (): Promise<LogStep> => {
      throw Object.assign(new Error("WhatsApp erro [429]: limite"), { status: 429 });
    };
    const r1 = await guardedDelivery(db as never, wa, c, "1", fail, () => new Date(t));
    expect(r1.ok).toBe(true);
    expect(r1.delivery?.provider_status).toBe("retry_scheduled");
    expect(new Date(r1.suspend_until!).getTime() - t).toBe(2 * 60_000);
    t += 3 * 60_000;
    const n = { n: 0 };
    const r2 = await guardedDelivery(db as never, wa, c, "1", okSend(n), () => new Date(t));
    expect(n.n).toBe(1);
    expect(r2.ok).toBe(true);
    expect(db.rows.values().next().value!.attempts).toBe(2);
  });

  it("após 4 tentativas o passo falha sem novo envio", async () => {
    const t = 0;
    const db = fakeDb({ clock: () => t });
    const c = ctx();
    const fail = async (): Promise<LogStep> => {
      throw Object.assign(new Error("[503]"), { status: 503 });
    };
    for (let i = 0; i < 3; i++) await guardedDelivery(db as never, wa, c, "1", fail);
    const last = await guardedDelivery(db as never, wa, c, "1", fail);
    expect(last.ok).toBe(false);
    const after = await guardedDelivery(db as never, wa, c, "1", fail);
    expect(after.ok).toBe(false);
    expect(after.error).toMatch(/4 tentativa/);
  });

  it("timeout: envio incerto não é reenviado; confirmado no histórico vira enviado", async () => {
    const db = fakeDb({ clock: () => 0 });
    const c = ctx();
    const timeout = async (): Promise<LogStep> => {
      throw new TypeError("fetch failed");
    };
    const r = await guardedDelivery(db as never, wa, c, "1", timeout);
    expect(r.ok).toBe(false);
    expect(r.delivery?.provider_status).toBe("uncertain");
    const n = { n: 0 };
    const again = await guardedDelivery(db as never, wa, c, "1", okSend(n));
    expect(n.n).toBe(0);
    expect(again.ok).toBe(false);

    const key = stableDeliveryKey(ctx("r9"), "1")!;
    const db2 = fakeDb({ clock: () => 0, waHistory: [key] });
    const r2 = await guardedDelivery(db2 as never, wa, ctx("r9"), "1", timeout);
    expect(r2.ok).toBe(true);
    expect(r2.delivery?.provider_status).toBe("reconciled_sent");
  });

  it("lease expirado (processo caiu) vira incerto e não reenvia", async () => {
    let t = 0;
    const db = fakeDb({ clock: () => t });
    db.rows.set("wfd:ws-wk:wf-1:run-1:1", {
      key: "wfd:ws-wk:wf-1:run-1:1",
      channel: "whatsapp",
      recipient: null,
      status: "in_flight",
      attempts: 1,
      lease: 100,
      created: 0,
    });
    t = 500;
    const n = { n: 0 };
    const r = await guardedDelivery(db as never, wa, ctx(), "1", okSend(n));
    expect(n.n).toBe(0);
    expect(r.delivery?.provider_status).toBe("uncertain");
  });

  it("cota comercial diária reagenda em vez de enviar", async () => {
    const db = fakeDb({ clock: () => 0, policy: { whatsapp_daily_limit: 1 } });
    const n = { n: 0 };
    await guardedDelivery(db as never, wa, ctx("r1", "5511900000001"), "1", okSend(n));
    const r = await guardedDelivery(db as never, wa, ctx("r2", "5511900000002"), "1", okSend(n));
    expect(n.n).toBe(1);
    expect(r.delivery?.provider_status).toBe("quota_reached");
    expect(r.suspend_until).toBeTruthy();
  });

  it("cota de WhatsApp não consome a de e-mail (canais separados)", async () => {
    const db = fakeDb({ clock: () => 0, policy: { whatsapp_daily_limit: 0 } });
    const n = { n: 0 };
    const r = await guardedDelivery(db as never, email, ctx(), "1", okSend(n));
    expect(r.ok).toBe(true);
    expect(n.n).toBe(1);
  });

  it("deduplicação: mesmo contato em outro fluxo dentro do período é ignorado", async () => {
    const db = fakeDb({ clock: () => 0, policy: { dedupe_hours: 24 } });
    const n = { n: 0 };
    await guardedDelivery(db as never, wa, ctx("r1"), "1", okSend(n));
    const r = await guardedDelivery(
      db as never,
      wa,
      { ...ctx("r2"), workflowId: "wf-2" },
      "1",
      okSend(n),
    );
    expect(n.n).toBe(1);
    expect(r.ok).toBe(true);
    expect(r.delivery?.provider_status).toBe("deduped");
  });

  it("fora do horário comercial o passo espera o próximo horário", async () => {
    // Domingo 12:00 em São Paulo (15:00 UTC); janela seg–sex 9–18.
    const sunday = new Date("2026-10-11T15:00:00Z");
    const db = fakeDb({
      clock: () => 0,
      policy: { weekdays: [1, 2, 3, 4, 5], window_start: 9, window_end: 18 },
    });
    const n = { n: 0 };
    const r = await guardedDelivery(db as never, wa, ctx(), "1", okSend(n), () => sunday);
    expect(n.n).toBe(0);
    expect(r.suspend_until).toBe("2026-10-12T12:00:00.000Z");
  });

  it("erro definitivo (4xx) falha sem nova tentativa", async () => {
    const db = fakeDb({ clock: () => 0 });
    const r = await guardedDelivery(db as never, wa, ctx(), "1", async () => {
      throw Object.assign(new Error("WhatsApp erro [400]: modelo inválido"), { status: 400 });
    });
    expect(r.ok).toBe(false);
    expect(r.suspend_until).toBeUndefined();
  });
});

describe("regras puras de envio", () => {
  it("classifica falhas", () => {
    expect(classifyFailure(Object.assign(new Error("x"), { status: 429 }))).toBe("retry");
    expect(classifyFailure(new Error("Outlook erro [502]: x"))).toBe("retry");
    expect(classifyFailure(new TypeError("fetch failed"))).toBe("uncertain");
    expect(classifyFailure(new Error("Contato descadastrado"))).toBe("permanent");
  });
  it("espera crescente limitada a 60 min", () => {
    expect([1, 2, 3, 6, 9].map((a) => backoffMs(a) / 60_000)).toEqual([2, 4, 8, 60, 60]);
  });
  it("sem janela configurada envia a qualquer hora", () => {
    expect(
      nextSendSlot(new Date(), {
        timezone: "America/Sao_Paulo",
        window_start: null,
        window_end: null,
        weekdays: [],
      }),
    ).toBeNull();
  });
  it("dentro da janela não espera", () => {
    expect(
      nextSendSlot(new Date("2026-10-13T15:00:00Z"), {
        timezone: "America/Sao_Paulo",
        window_start: 9,
        window_end: 18,
        weekdays: [1, 2, 3, 4, 5],
      }),
    ).toBeNull();
  });
});
