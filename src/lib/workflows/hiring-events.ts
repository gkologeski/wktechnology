// Eventos canônicos do ciclo de contratação/desligamento.
// O motor dispara workflows a partir de mudanças em registros (criado,
// atualizado, mudou de etapa). Cada evento canônico é, portanto, um gatilho
// pré-configurado sobre uma entidade existente — sem novo mecanismo de fila e
// sem fluxo fixo no código: cada workspace monta (ou desativa) os passos.
import type { WorkflowEntity, WorkflowTrigger } from "./types";

export type HiringEventKey = "ats.candidate.hired" | "contracts.contract.signed";

export interface HiringEventPreset {
  key: HiringEventKey;
  label: string;
  description: string;
  entity: WorkflowEntity;
  trigger: WorkflowTrigger;
}

export const HIRING_EVENT_PRESETS: Record<HiringEventKey, HiringEventPreset> = {
  "ats.candidate.hired": {
    key: "ats.candidate.hired",
    label: "Candidato contratado",
    description: "A candidatura entra na etapa Contratado do TechHire.",
    entity: "ats_applications",
    trigger: {
      event: "stage_changed",
      filters: [{ field: "stage_value", op: "changed_to", value: "hired" }],
    },
  },
  "contracts.contract.signed": {
    key: "contracts.contract.signed",
    label: "Contrato assinado",
    description: "O contrato recebe data de assinatura no TechContracts.",
    entity: "contracts",
    // Sem reinscrição: o registro só entra no fluxo na primeira vez que a
    // assinatura é registrada.
    trigger: {
      event: "updated",
      filters: [{ field: "signed_at", op: "is_not_empty" }],
      reenroll: { enabled: false },
    },
  },
};

/** Chave de idempotência por evento + registro (ex.: ats.candidate.hired:<id>). */
export function hiringDedupeKey(event: HiringEventKey, recordId: string): string {
  return `${event}:${recordId}`;
}
