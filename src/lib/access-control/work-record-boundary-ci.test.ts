// Fronteira por registro do TechProjects/TechContracts: `assertWorkRecord`
// delega ao RPC `work_record_access` (membership ativo, workspace, cargo, deny
// e escopo resolvidos no banco). Estes cenários garantem que o servidor não
// prossegue quando o banco nega, inclusive em erro do RPC.
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertWorkRecord } from "./work-core.server";

const TASK = "11111111-1111-4111-8111-111111111111";

function client(result: { data: unknown; error: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("work record boundary (techprojects.tasks)", () => {
  it("work record boundary allows an authorized active member to update a task", async () => {
    const { client: c, rpc } = client({ data: true, error: null });
    await expect(
      assertWorkRecord(c, "techprojects.tasks", TASK, "update"),
    ).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("work_record_access", {
      r: "techprojects.tasks",
      i: TASK,
      a: "update",
    });
  });

  it("work record boundary rejects a task update without the update key", async () => {
    const { client: c } = client({ data: false, error: null });
    await expect(assertWorkRecord(c, "techprojects.tasks", TASK, "update")).rejects.toThrow(
      /sem permissão/i,
    );
  });

  it("work record boundary rejects a task update under explicit deny", async () => {
    // Deny prevalece no banco: o RPC devolve false mesmo com a chave concedida.
    const { client: c, rpc } = client({ data: false, error: null });
    await expect(assertWorkRecord(c, "techprojects.tasks", TASK, "update")).rejects.toThrow(
      /indisponível/i,
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("work record boundary rejects a task from another workspace", async () => {
    const { client: c } = client({ data: null, error: null });
    await expect(assertWorkRecord(c, "techprojects.tasks", TASK, "view")).rejects.toThrow(
      /indisponível/i,
    );
  });

  it("work record boundary rejects an inactive workspace member", async () => {
    const { client: c } = client({ data: null, error: { message: "Acesso não autorizado." } });
    await expect(assertWorkRecord(c, "techprojects.tasks", TASK, "update")).rejects.toThrow(
      "Acesso não autorizado.",
    );
  });
});
