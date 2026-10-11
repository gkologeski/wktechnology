import { describe, expect, it } from "vitest";
import { workspaceOfSource, requireSourceWorkspaceAccess } from "./workspace-source.server";

function clientResult(data: unknown, error: { message: string } | null = null) {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data, error }),
  };
  return { from: () => query };
}

describe("workspace do registro de origem", () => {
  it("preserva o tenant do registro sem derivar do responsável ou da sessão", async () => {
    expect(
      await workspaceOfSource(
        clientResult({ workspace_id: "tenant-B" }) as never,
        "leads",
        "lead-B",
      ),
    ).toBe("tenant-B");
  });
  it("recusa registro oculto, sem tenant ou consulta recusada", async () => {
    await expect(workspaceOfSource(clientResult(null) as never, "leads", "hidden")).rejects.toThrow(
      "indisponível",
    );
    await expect(
      workspaceOfSource(clientResult({ workspace_id: null }) as never, "leads", "legacy"),
    ).rejects.toThrow("workspace");
    await expect(
      workspaceOfSource(clientResult(null, { message: "denied" }) as never, "leads", "hidden"),
    ).rejects.toThrow("denied");
  });
});

const workspaceB = "bbbbbbbb-0000-4000-8000-00000000000b";
describe("workspace capturado no início de uma integração", () => {
  it("preserva o workspace autorizado sem consultar o workspace ativo", async () => {
    const queried: string[] = [];
    const client = {
      from: (table: string) => {
        queried.push(table);
        return clientResult(
          table === "workspace_members" ? { workspace_id: workspaceB } : null,
        ).from();
      },
    };
    expect(await requireSourceWorkspaceAccess(client as never, "user", workspaceB)).toBe(
      workspaceB,
    );
    expect(queried).toEqual(["platform_admins", "workspace_members"]);
  });
  it("recusa membership removida e estados legados sem workspace", async () => {
    await expect(
      requireSourceWorkspaceAccess(clientResult(null) as never, "user", workspaceB),
    ).rejects.toThrow("indisponível");
    await expect(
      requireSourceWorkspaceAccess(clientResult(null) as never, "user", undefined),
    ).rejects.toThrow("Reconecte");
  });
});
