import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { newDefinition, newStep } from "./draft";
import { decideExecution, type ExecutionSignals } from "./runtime";
import { processSequenceRun, type RuntimeContext, type SequenceRun } from "./worker.server";
import { pickUnsuppressedWhatsApp, suppressionKey } from "@/lib/whatsapp/whatsapp-suppression";

const now = new Date("2026-11-02T13:00:00Z");
const signals: ExecutionSignals = {
  optedOut: false,
  replied: false,
  previousReplied: false,
  meetingBooked: false,
  callAnswered: false,
  hasPhone: true,
  hasEmail: true,
  hasWhatsApp: false,
};

describe("WhatsApp bloqueado pela Meta nas sequências", () => {
  it("escolhe o próximo celular do cadastro quando o primeiro está bloqueado", () => {
    const blocked = new Map([[suppressionKey("+5548991110000"), "no_whatsapp" as const]]);
    const r = pickUnsuppressedWhatsApp(["+5548991110000", "+5548992220000"], blocked);
    expect(r.pick).toEqual({ status: "ok", e164: "+5548992220000" });
    expect(r.blockedBy).toBe("no_whatsapp");
  });
  it("sem outro celular, informa o bloqueio e não devolve número", () => {
    const blocked = new Map([[suppressionKey("+5548991110000"), "engagement_limit" as const]]);
    const r = pickUnsuppressedWhatsApp(["+5548991110000", "+554833334444"], blocked);
    expect(r.pick.status).not.toBe("ok");
    expect(r.blockedBy).toBe("engagement_limit");
  });
  it("etapa de WhatsApp com número sem WhatsApp é pulada para o próximo passo", () => {
    const definition = newDefinition();
    definition.steps = [newStep("whatsapp"), newStep("call")];
    const decision = decideExecution({
      runId: "r",
      state: "active",
      cursor: 0,
      definition,
      signals: { ...signals, whatsAppSuppressed: "no_whatsapp" },
      now,
      previousAt: now,
    });
    expect(decision).toMatchObject({
      kind: "advance",
      nextStep: 1,
      reason: "whatsapp_suppressed_no_whatsapp",
    });
  });
  it("worker não envia e avança quando o único celular está bloqueado", async () => {
    const run: SequenceRun = {
      id: crypto.randomUUID(),
      workspace_id: crypto.randomUUID(),
      owner_id: crypto.randomUUID(),
      state: "active",
      cursor: 0,
      lease_token: crypto.randomUUID(),
      previous_at: null,
    };
    const definition = newDefinition();
    definition.steps = [newStep("whatsapp"), newStep("call")];
    const context: RuntimeContext = {
      run,
      definition,
      person: { id: crypto.randomUUID(), entity: "contact" },
      source: { email: null, phones: ["+5548991110000"] },
      signals: {
        optedOut: false,
        replied: false,
        previousReplied: false,
        meetingBooked: false,
        callAnswered: false,
      },
    };
    const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => ({
      data: name === "prospecting_sequence_context" ? context : true,
      error: null,
      args,
    }));
    const query = {
      select: () => query,
      eq: (col: string, val: unknown) => {
        expect(col === "workspace_id" ? val : run.workspace_id).toBe(run.workspace_id);
        return query;
      },
      in: () => query,
      is: async () => ({
        data: [
          {
            phone_key: suppressionKey("+5548991110000"),
            reason: "no_whatsapp",
            expires_at: "2099-01-01T00:00:00Z",
            released_at: null,
          },
        ],
        error: null,
      }),
    };
    const admin = { rpc, from: vi.fn(() => query) } as unknown as SupabaseClient;
    const prepare = vi.fn();
    const result = await processSequenceRun(admin, run, { prepare, handoff: vi.fn() }, now);
    expect(result.status).toBe("advance");
    expect(prepare).not.toHaveBeenCalled();
    const transition = rpc.mock.calls.find(([n]) => n === "prospecting_sequence_transition");
    expect(transition?.[1]).toMatchObject({
      p_cursor: 1,
      p_reason: "whatsapp_suppressed_no_whatsapp",
    });
  });
});
