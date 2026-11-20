import { describe, expect, expectTypeOf, it } from "vitest";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_EVENT_CATALOG,
  getNotificationEvent,
  resolveLegacyNotificationEvent,
  withNotificationEvent,
  type NotificationEventKey,
} from "./notification-catalog";

// Independently enumerated producer inventory. Do not derive this fixture from the catalogue:
// dropping an alias must fail even when the catalogue and its indexes change together.
const LEGACY_ALIASES = [
  ["mention", "mention"],
  ["assignment", "assignment"],
  ["deal_stage", "deal_stage"],
  ["ticket", "ticket"],
  ["task", "task"],
  ["sla", "sla"],
  ["message", "message"],
  ["workflow", "workflow"],
  ["approval", "approval"],
  ["role_profile", "hiring"],
  ["role_profile_approval", "approval"],
  ["hiring_approval", "approval"],
  ["hiring_preparation_approval", "approval"],
  ["hiring_formalization", "hiring"],
  ["form_submission", "form"],
  ["portfolio_conflict", "portfolio"],
  ["sequence_handoff", "task"],
  ["security_scan", "platform"],
  ["platform_alert", "platform"],
  ["sla.first_response_breach", "sla"],
  ["sla.resolution_breach", "sla"],
  ["sla.at_risk", "sla"],
] as const;

describe("catálogo compatível com notificações históricas", () => {
  it("mantém o contrato de chaves como união fechada, sem aceitar strings arbitrárias", () => {
    expectTypeOf<NotificationEventKey>().not.toEqualTypeOf<string>();
    expectTypeOf<"legacy.mention" | "crm.deal.won">().toExtend<NotificationEventKey>();
  });
  it.each(LEGACY_ALIASES)(
    "resolve o tipo %s sem converter o evento de negócio",
    (type, category) => {
      const resolved = resolveLegacyNotificationEvent(type);
      expect(resolved).toMatchObject({
        eventKey: `legacy.${type}`,
        category,
        moduleKey: null,
        availability: "legacy",
        legacyTypes: [type],
      });
      expect(getNotificationEvent(`legacy.${type}`)).toBe(resolved);
    },
  );

  it("possui chaves únicas, aliases não conflitantes e categorias registradas", () => {
    const keys = NOTIFICATION_EVENT_CATALOG.map((entry) => entry.eventKey);
    const aliases = NOTIFICATION_EVENT_CATALOG.flatMap((entry) => [...entry.legacyTypes]);
    const categories = NOTIFICATION_CATEGORIES.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(aliases).size).toBe(aliases.length);
    expect(new Set(categories).size).toBe(categories.length);
    expect([...aliases].sort()).toEqual(LEGACY_ALIASES.map(([type]) => type).sort());
    for (const entry of NOTIFICATION_EVENT_CATALOG) {
      expect(categories).toContain(entry.category);
      expect(entry.label.trim()).not.toBe("");
    }
  });

  it("documenta eventos dos seis módulos como planejados, sem torná-los aliases ativos", () => {
    const examples = [
      ["crm.deal.won", "crm"],
      ["ats.application.received", "ats"],
      ["people.employment.started", "people"],
      ["contracts.signature.completed", "contracts"],
      ["finance.payable.due", "finance"],
      ["projects.project.started", "projects"],
    ] as const;
    for (const [eventKey, moduleKey] of examples) {
      expect(getNotificationEvent(eventKey)).toMatchObject({
        eventKey,
        moduleKey,
        availability: "planned",
        legacyTypes: [],
      });
      expect(resolveLegacyNotificationEvent(eventKey)).toBeNull();
    }
    const plannedModules = NOTIFICATION_EVENT_CATALOG.filter(
      (event) => event.availability === "planned" && event.moduleKey !== null,
    ).map((event) => event.moduleKey);
    expect([...new Set(plannedModules)].sort()).toEqual([
      "ats",
      "contracts",
      "crm",
      "finance",
      "people",
      "projects",
    ]);
    expect(getNotificationEvent("shared.approval.pending")).toMatchObject({
      availability: "planned",
      moduleKey: null,
    });
  });

  it.each([
    "hiring_approval",
    "hiring_preparation_approval",
    "hiring_formalization",
    "workflow",
    "approval",
  ])("não adivinha módulo pelo conteúdo de %s", (type) => {
    for (const link of [
      "/people/hiring-requests?request=demo",
      "/contracts/supplier-requests?request=demo",
    ]) {
      const row = withNotificationEvent({
        type,
        title: "Financeiro aprovou contrato do projeto",
        entity: "hiring_preparation_request",
        link,
        workspace_id: null,
        owner_id: "historical-owner-is-not-a-workspace",
      });
      expect(row.event?.eventKey).toBe(`legacy.${type}`);
      expect(row.event?.moduleKey).toBeNull();
      expect(row.workspace_id).toBeNull();
    }
  });

  it("acrescenta metadados sem alterar registro, IDs, leitura, chave ou destino históricos", () => {
    const row = Object.freeze({
      id: "notification-id",
      type: "message",
      owner_id: "historical-owner",
      user_id: "recipient-id",
      workspace_id: null,
      entity: "inbox_conversation",
      entity_id: "conversation-id",
      title: "Título histórico",
      body: "Texto histórico",
      link: "/inbox/whatsapp?conversation=conversation-id",
      dedupe_key: "whatsapp_messages:message-id:recipient-id",
      created_at: "2026-01-02T03:04:05Z",
      read_at: "2026-01-02T04:04:05Z",
    });
    const decorated = withNotificationEvent(row);
    const { event, ...unchanged } = decorated;
    expect(unchanged).toEqual(row);
    expect(decorated).not.toBe(row);
    expect(Object.hasOwn(row, "event")).toBe(false);
    expect(event).toEqual({ eventKey: "legacy.message", category: "message", moduleKey: null });
  });

  it.each([
    null,
    undefined,
    "",
    "future.event",
    "sla.future_breach",
    "__proto__",
    "constructor",
    "toString",
    0,
    {},
    [],
  ])("nega resolução implícita para tipo desconhecido ou inválido %j", (type) => {
    expect(resolveLegacyNotificationEvent(type)).toBeNull();
    expect(getNotificationEvent(type)).toBeNull();
  });

  it("preserva avisos desconhecidos e retorna metadados nulos", () => {
    const row = { type: "future.event", title: "Não descartar", id: "old-id", link: "/original" };
    expect(withNotificationEvent(row)).toEqual({ ...row, event: null });
    expect(withNotificationEvent({ type: null, id: "no-type" })).toEqual({
      type: null,
      id: "no-type",
      event: null,
    });
  });
});
