import { describe, expect, it } from "vitest";
import { parseActionAtDepth } from "./schemas";
import { ACTION_LABELS } from "./types";
import { HIRING_EVENT_PRESETS, hiringDedupeKey } from "./hiring-events";

const TYPES = [
  "create_person_from_candidate",
  "create_contract_document",
  "create_allocation",
  "create_payable_schedule",
  "create_receivable_invoice",
  "provision_workspace_user",
] as const;

describe("ações de contratação (Fase 1)", () => {
  it("todas têm rótulo em PT-BR", () => {
    for (const t of TYPES) expect(ACTION_LABELS[t]).toBeTruthy();
  });

  it("valida configuração mínima", () => {
    expect(parseActionAtDepth({ type: "create_person_from_candidate", department: "Comercial" }, 0)).toMatchObject({ type: "create_person_from_candidate" });
    expect(parseActionAtDepth({ type: "create_payable_schedule", amount: "8000", installments: 12, day_of_month: 10 }, 0)).toMatchObject({ amount: "8000" });
    expect(() => parseActionAtDepth({ type: "create_payable_schedule", amount: "", installments: 30 }, 0)).toThrow();
    expect(() => parseActionAtDepth({ type: "provision_workspace_user", permission_set_id: "x" }, 0)).toThrow();
  });

  it("evento de contratação usa a etapa Contratado das candidaturas", () => {
    const p = HIRING_EVENT_PRESETS["ats.candidate.hired"];
    expect(p.entity).toBe("ats_applications");
    expect(p.trigger.event).toBe("stage_changed");
    expect(hiringDedupeKey("ats.candidate.hired", "abc")).toBe("ats.candidate.hired:abc");
  });
});
