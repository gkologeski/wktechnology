import { describe, expect, it } from "vitest";
import {
  mapStatus,
  msToLocalDate,
  planGroup,
  taskPayload,
  type CuHierarchyList,
} from "./clickup-plan";

const erp = {
  projects: [
    { id: "p-citel", name: "OS - Citel" },
    { id: "p-informa", name: "OS - InForma" },
    { id: "p-active", name: "OS - Active" },
    { id: "p-desb", name: "OS - Desbravador" },
    { id: "p-gestao", name: "Gestão" },
    { id: "p-brooks", name: "FS - Brooks" },
    { id: "p-byteway-old", name: "Fábrica -> Byteway -> Leitor Web x XLS" },
  ],
  spaces: [
    { id: "s-fab", name: "Fábrica de Software" },
    { id: "s-os", name: "OutSourcing" },
  ],
};

const list = (o: Partial<CuHierarchyList>): CuHierarchyList => ({
  teamId: "1",
  teamName: "WK Technology",
  spaceId: "2",
  spaceName: "Diretoria",
  folderId: null,
  folderName: null,
  listId: "3",
  listName: "List",
  ...o,
});

describe("organização proposta do ClickUp", () => {
  it("deixa de fora os workspaces de teste", () => {
    for (const teamName of ["FS - Cliente Exemplo", "CS", "OS - Logbit"])
      expect(planGroup(list({ teamName }), erp).action).toBe("skip");
  });
  it("Byteway da Consultoria vira projeto novo com o nome do ClickUp", () => {
    const g = planGroup(
      list({
        spaceName: "Consultoria",
        folderName: "CT/Byteway - 10/2025",
        listName: "Desenvolvimento",
      }),
      erp,
    );
    expect(g.target_project_id).toBeNull();
    expect(g.new_project_name).toBe("CT/Byteway - 10/2025");
    expect(g.new_space_name).toBe("Consultoria");
  });
  it("Dailys do Outsourcing entram como tarefas no espaço OutSourcing", () => {
    const g = planGroup(list({ spaceName: "Outsourcing", listName: "Dailys" }), erp);
    expect(g.action).toBe("import");
    expect(g.target_space_id).toBe("s-os");
    expect(g.new_project_name).toBe("OS - Controles internos");
    expect(g.erp_list_name).toBe("Dailys");
  });
  it("workspace de cliente liga ao projeto existente, inclusive In Forma -> InForma", () => {
    expect(
      planGroup(list({ teamName: "OS - Citel", spaceName: "Citel", listName: "Demandas" }), erp)
        .target_project_id,
    ).toBe("p-citel");
    expect(
      planGroup(list({ teamName: "OS - In Forma", spaceName: "OS - In Forma" }), erp)
        .target_project_id,
    ).toBe("p-informa");
    expect(
      planGroup(list({ teamName: "OS - ActiveCorp", spaceName: "x" }), erp).target_project_id,
    ).toBe("p-active");
    expect(
      planGroup(list({ teamName: "[ARQUIVADO] OS - Desbravador", spaceName: "x" }), erp)
        .target_project_id,
    ).toBe("p-desb");
  });
  it("Gestão vai para o projeto Gestão e Brooks para FS - Brooks", () => {
    expect(
      planGroup(list({ spaceName: "Gestão", listName: "Tarefas" }), erp).target_project_id,
    ).toBe("p-gestao");
    const b = planGroup(
      list({
        spaceName: "Fábrica de Software",
        folderName: "FS/Brooks -> Escopo Aberto",
        listName: "List",
      }),
      erp,
    );
    expect(b.target_project_id).toBe("p-brooks");
    expect(b.target_space_id).toBe("s-fab");
    expect(b.erp_list_name).toBe("FS/Brooks -> Escopo Aberto");
  });
});

describe("nome da lista", () => {
  it("lista e espaço genéricos usam o nome do workspace do cliente", () => {
    const g = planGroup(
      list({ teamName: "OS - ActiveCorp", spaceName: "Space", listName: "List" }),
      erp,
    );
    expect(g.erp_list_name).toBe("OS - ActiveCorp");
  });
});

describe("conversão de tarefas", () => {
  it("status fechado vira concluído e nomes conhecidos viram etapas", () => {
    expect(mapStatus("qualquer", "closed")).toBe("done");
    expect(mapStatus("Em andamento", "custom")).toBe("doing");
    expect(mapStatus("Homologação", "custom")).toBe("review");
    expect(mapStatus("to do", "open")).toBe("todo");
  });
  it("datas usam o dia de São Paulo", () => {
    // 2026-01-01T02:00Z = 31/12/2025 23:00 em São Paulo
    expect(msToLocalDate(Date.UTC(2026, 0, 1, 2))).toBe("2025-12-31");
    expect(msToLocalDate(null)).toBeNull();
  });
  it("monta a carga com responsáveis, etiquetas e prioridade", () => {
    const p = taskPayload({
      id: "86a1",
      name: "  Ajustar relatório ",
      status: { status: "concluido", type: "closed" },
      priority: { priority: "urgent" },
      tags: [{ name: "bug" }],
      assignees: [{ id: 55 }],
    });
    expect(p).toMatchObject({
      title: "Ajustar relatório",
      status: "done",
      priority: "urgent",
      tags: ["bug"],
      assignees: ["55"],
    });
  });
});
