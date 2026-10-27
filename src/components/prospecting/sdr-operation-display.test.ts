import { describe, expect, it } from "vitest";
import {
  buildSdrFunnel,
  commercialStageLabel,
  formatMeetingTime,
  meetingStatusDisplay,
  qualificationDecisionLabel,
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

describe("Resultados do Agente SDR", () => {
  it("calcula o funil sobre as conversas iniciadas", () => {
    const f = buildSdrFunnel({
      started: 1055,
      replied: 200,
      qualified: 0,
      meetingProposed: 3,
      meetingConfirmed: 2,
    });
    expect(f.map((s) => s.label)).toEqual([
      "Conversas iniciadas",
      "Responderam",
      "Qualificados",
      "Reunião proposta",
      "Reunião confirmada",
    ]);
    expect(f.map((s) => s.pct)).toEqual([100, 19, 0, 0, 0]);
    expect(f[4].value).toBe(2);
    expect(f.map((s) => s.pctLabel)).toEqual(["100%", "19%", "0%", "<1%", "<1%"]);
  });

  it("sem conversas não inventa percentual", () => {
    const f = buildSdrFunnel({
      started: 0,
      replied: 0,
      qualified: 0,
      meetingProposed: 0,
      meetingConfirmed: 0,
    });
    expect(f.every((s) => s.pct === null && s.pctLabel === "—")).toBe(true);
  });

  it("traduz situação da reunião e decisão da qualificação", () => {
    expect(meetingStatusDisplay("confirmed")).toEqual({ label: "Confirmada", tone: "open" });
    expect(meetingStatusDisplay("sync_failed").label).toBe("Falha no Google");
    expect(meetingStatusDisplay("xyz").label).toBe("Outra situação");
    expect(qualificationDecisionLabel("disqualified")).toBe("Desqualificado");
    expect(qualificationDecisionLabel(undefined)).toBe("Outra decisão");
  });

  it("mostra a hora da reunião no fuso dela, não em UTC", () => {
    expect(formatMeetingTime("2026-10-22T18:00:00+00:00", "America/Sao_Paulo")).toBe(
      "22/10/2026 15:00",
    );
    expect(formatMeetingTime("2026-10-22T18:00:00+00:00", "Fuso/Invalido")).toBe(
      "22/10/2026 15:00",
    );
    expect(formatMeetingTime(null)).toBe("—");
  });
});
