import { describe, expect, it } from "vitest";
import {
  describeTemplate,
  parseTemplateText,
  templateKey,
  templateToText,
} from "./delivery-template.shared";

describe("delivery-template.shared", () => {
  it("gera chaves estáveis e únicas", () => {
    const used = new Set<string>();
    expect(templateKey("Levantamento de requisitos", used)).toBe("levantamento_de_requisitos");
    expect(templateKey("Levantamento de requisitos", used)).toBe("levantamento_de_requisitos_2");
    expect(templateKey("Ação!", used)).toBe("acao");
  });

  it("liga tarefas ao marco pelo nome e lê prazo/horas", () => {
    const def = parseTemplateText(
      "Kickoff | 0\nHomologação | 30",
      "Kickoff > Reunião inicial | 2\nTarefa solta\nOutro > Sem marco",
      true,
    );
    expect(def.milestones).toEqual([
      { key: "kickoff", name: "Kickoff", offset_days: 0 },
      { key: "homologacao", name: "Homologação", offset_days: 30 },
    ]);
    expect(def.tasks?.[0]).toEqual({
      key: "reuniao_inicial",
      title: "Reunião inicial",
      milestone_key: "kickoff",
      estimated_hours: 2,
    });
    expect(def.tasks?.[1]).toEqual({ key: "tarefa_solta", title: "Tarefa solta" });
    expect(def.tasks?.[2]?.milestone_key).toBeUndefined();
    expect(def.client_acceptance).toBe(true);
    expect(describeTemplate(def)).toBe("2 marco(s) · 3 tarefa(s) · liga o aceite do cliente");
  });

  it("ida e volta preserva o texto", () => {
    const def = parseTemplateText("Kickoff | 0", "Kickoff > Reunião inicial | 2", false);
    const txt = templateToText(def);
    expect(txt.milestones).toBe("Kickoff | 0");
    expect(txt.tasks).toBe("Kickoff > Reunião inicial | 2");
  });
});
