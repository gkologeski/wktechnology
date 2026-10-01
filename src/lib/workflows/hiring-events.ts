// Eventos canônicos do ciclo de contratação/desligamento.
// O motor dispara workflows a partir de mudanças em registros (criado,
// atualizado, mudou de etapa). Cada evento canônico é, portanto, um gatilho
// pré-configurado sobre uma entidade existente — sem novo mecanismo de fila e
// sem fluxo fixo no código: cada workspace monta (ou desativa) os passos.
import type { WorkflowEntity, WorkflowTrigger } from "./types";

export type HiringEventKey =
  | "ats.candidate.hired"
  | "contracts.contract.signed"
  | "people.person.terminated";

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
      // Status "hired" é aplicado em qualquer etapa de desfecho "ganho" do
      // pipeline da vaga (o slug da etapa varia por workspace).
      filters: [{ field: "status", op: "changed_to", value: "hired" }],
    },
  },
  "people.person.terminated": {
    key: "people.person.terminated",
    label: "Pessoa desligada",
    description: "A pessoa passa para o status Desligado no TechPeople.",
    entity: "people",
    trigger: {
      event: "stage_changed",
      filters: [{ field: "status", op: "changed_to", value: "terminated" }],
      reenroll: { enabled: false },
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
