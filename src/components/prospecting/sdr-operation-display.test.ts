import { describe, expect, it } from "vitest";
import {
  commercialStageLabel,
  enrollmentDisplayName,
  enrollmentStatusDisplay,
  parseEnrollmentFilter,
  supervisionCounts,
} from "./sdr-operation-display";

describe("Operação do Agente SDR — rótulos", () => {
  it("traduz as situações reais do atendimento", () => {
    expect(enrollmentStatusDisplay("active")).toEqual({ label: "Em conversa", tone: "open" });
    expect(enrollmentStatusDisplay("paused").label).toBe("Pausado");
    expect(enrollmentStatusDisplay("handoff").label).toBe("Com humano");
    expect(enrollmentStatusDisplay("opted_out")).toEqual({ label: "Recusou", tone: "closed" });
  });

  it("situação desconhecida não aparece em inglês", () => {
    expect(enrollmentStatusDisplay("weird_state").label).toBe("Outra situação");
    expect(enrollmentStatusDisplay(null).label).toBe("Outra situação");
  });

  it("traduz a etapa comercial e usa travessão quando vazia", () => {
    expect(commercialStageLabel("awaiting_reply")).toBe("Aguardando resposta");
    expect(commercialStageLabel("meeting_booked")).toBe("Reunião marcada");
    expect(commercialStageLabel(null)).toBe("—");
  });

  it("mostra o nome do contato e, sem nome, o telefone", () => {
    expect(enrollmentDisplayName({ first_name: " Ana ", last_name: "Souza" }, "+5548")).toBe(
      "Ana Souza",
    );
    expect(enrollmentDisplayName(null, "+5548999990000")).toBe("+5548999990000");
    expect(enrollmentDisplayName({ first_name: "", last_name: null }, null)).toBe(
      "Contato sem nome",
    );
  });

  it("aceita apenas filtros conhecidos no endereço", () => {
    expect(parseEnrollmentFilter("handoff")).toBe("handoff");
    expect(parseEnrollmentFilter("canceled")).toBeUndefined();
    expect(parseEnrollmentFilter(1)).toBeUndefined();
  });

  it("separa rascunhos, falhas e itens em processamento", () => {
    expect(
      supervisionCounts([
        { status: "drafted" },
        { status: "drafted" },
        { status: "failed" },
        { status: "queued" },
        { status: "running" },
      ]),
    ).toEqual({ toReview: 2, failed: 1, processing: 2 });
  });
});
