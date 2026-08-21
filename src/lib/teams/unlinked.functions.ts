// Server functions para contas órfãs: listar contas sem workspace e vinculá-las.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertWorkspaceAdmin,
  findUnlinkedAccounts,
  linkAccountToWorkspace,
  resolveWorkspaceId,
  type UnlinkedAccount,
} from "./unlinked.server";

export type { UnlinkedAccount };

export const listUnlinkedAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ accounts: UnlinkedAccount[] }> => {
    const ws = await resolveWorkspaceId(context.userId);
    await assertWorkspaceAdmin(ws.id, context.userId);
    return { accounts: await findUnlinkedAccounts(ws.id) };
  });

export const linkUnlinkedAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        user_id: z.string().uuid(),
        role: z.enum(["admin", "manager", "member"]).default("member"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const ws = await resolveWorkspaceId(context.userId);
    await assertWorkspaceAdmin(ws.id, context.userId);
    await linkAccountToWorkspace({
      workspaceId: ws.id,
      workspaceCreatedBy: ws.created_by,
      userId: data.user_id,
      role: data.role,
    });
    return { ok: true };
  });
