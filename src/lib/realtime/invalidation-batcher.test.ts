import { describe, expect, it } from "vitest";
import {
  buildChannelName,
  createInvalidationBatcher,
  payloadMatchesFilter,
} from "./invalidation-batcher";
import { planIdlePreload, isConstrainedConnection } from "@/lib/preload/idle-list-plan";
import { cacheActionForAuthEvent } from "@/lib/session-cache";

function fakeClock() {
  let t = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let seq = 0;
  return {
    now: () => t,
    setTimer: (fn: () => void, ms: number) => {
      const id = ++seq;
      timers.set(id, { at: t + ms, fn });
      return id;
    },
    clearTimer: (h: unknown) => void timers.delete(h as number),
    advance(ms: number) {
      const end = t + ms;
      for (;;) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        t = next[1].at;
        timers.delete(next[0]);
        next[1].fn();
      }
      t = end;
    },
  };
}

describe("filtro de eventos em tempo real", () => {
  it("evento de outro negócio não recarrega", () => {
    expect(
      payloadMatchesFilter("id=eq.A", { eventType: "UPDATE", new: { id: "B" }, old: { id: "B" } }),
    ).toBe(false);
  });
  it("evento do próprio negócio recarrega", () => {
    expect(payloadMatchesFilter("id=eq.A", { eventType: "UPDATE", new: { id: "A" } })).toBe(true);
  });
  it("atividade desvinculada do negócio (UPDATE) ainda recarrega", () => {
    expect(
      payloadMatchesFilter("related_deal_id=eq.A", {
        eventType: "UPDATE",
        new: { id: "x", related_deal_id: "B" },
        old: { id: "x", related_deal_id: "A" },
      }),
    ).toBe(true);
  });
  it("DELETE sem a coluna do filtro é tratado de forma conservadora", () => {
    expect(
      payloadMatchesFilter("related_deal_id=eq.A", { eventType: "DELETE", old: { id: "x" } }),
    ).toBe(true);
  });
  it("filtro in.(a,b)", () => {
    expect(payloadMatchesFilter("id=in.(A,B)", { eventType: "INSERT", new: { id: "B" } })).toBe(
      true,
    );
    expect(payloadMatchesFilter("id=in.(A,B)", { eventType: "INSERT", new: { id: "C" } })).toBe(
      false,
    );
  });
});

describe("identidade do canal", () => {
  it("filtros ou escopos diferentes geram canais diferentes", () => {
    const a = buildChannelName([{ table: "deals", filter: "id=eq.A" }], "ws1");
    const b = buildChannelName([{ table: "deals", filter: "id=eq.B" }], "ws1");
    const c = buildChannelName([{ table: "deals", filter: "id=eq.A" }], "ws2");
    expect(new Set([a, b, c]).size).toBe(3);
  });
});

describe("agrupamento de invalidações", () => {
  it("rajada de 20 eventos vira 1 recarga com chaves deduplicadas", () => {
    const clock = fakeClock();
    const flushes: unknown[][] = [];
    const b = createInvalidationBatcher((k) => flushes.push(k), {
      ...clock,
      delayMs: 250,
      maxWaitMs: 1000,
    });
    for (let i = 0; i < 20; i++) {
      b.push([["deals", "A"]]);
      clock.advance(10);
    }
    clock.advance(300);
    expect(flushes).toHaveLength(1);
    expect(flushes[0]).toEqual([["deals", "A"]]);
  });
  it("rajada contínua não causa fome: recarrega em no máximo 1 s", () => {
    const clock = fakeClock();
    let count = 0;
    const b = createInvalidationBatcher(() => count++, { ...clock, delayMs: 250, maxWaitMs: 1000 });
    for (let i = 0; i < 30; i++) {
      b.push([["k"]]);
      clock.advance(100);
    }
    expect(count).toBeGreaterThanOrEqual(2);
  });
  it("cancel (desmontar) descarta pendências", () => {
    const clock = fakeClock();
    let count = 0;
    const b = createInvalidationBatcher(() => count++, clock);
    b.push([["k"]]);
    b.cancel();
    clock.advance(5000);
    expect(count).toBe(0);
  });
});

describe("pré-carregamento seletivo", () => {
  const base = {
    activeModule: "crm",
    canAccessModule: () => true,
    canAny: () => true,
    permissionsReady: true,
    currentPath: "/home",
  };
  it("sem permissão de leitura não pré-carrega", () => {
    expect(planIdlePreload({ ...base, canAny: () => false })).toEqual([]);
  });
  it("outro módulo ativo não pré-carrega listas do TechSales", () => {
    expect(planIdlePreload({ ...base, activeModule: "ats" })).toEqual([]);
  });
  it("antes das permissões carregarem não pré-carrega", () => {
    expect(planIdlePreload({ ...base, permissionsReady: false })).toEqual([]);
  });
  it("economia de dados desliga o pré-carregamento", () => {
    expect(isConstrainedConnection({ saveData: true })).toBe(true);
    expect(planIdlePreload({ ...base, connection: { effectiveType: "2g" } })).toEqual([]);
  });
  it("limita a 2 listas e exclui a tela atual", () => {
    const plan = planIdlePreload({ ...base, currentPath: "/deals" });
    expect(plan).toHaveLength(2);
    expect(plan.map((p) => p.to)).not.toContain("/deals");
  });
});

describe("cache por identidade", () => {
  it("sair limpa sem recarregar", () => {
    expect(cacheActionForAuthEvent("SIGNED_OUT", "u1", null)).toBe("clear");
  });
  it("Ver como (outro usuário) zera o cache", () => {
    expect(cacheActionForAuthEvent("SIGNED_IN", "admin", "alvo")).toBe("reset");
  });
  it("renovação de token não mexe no cache", () => {
    expect(cacheActionForAuthEvent("TOKEN_REFRESHED", "u1", "u1")).toBe("none");
  });
  it("mesmo usuário só invalida", () => {
    expect(cacheActionForAuthEvent("SIGNED_IN", "u1", "u1")).toBe("invalidate");
  });
});
