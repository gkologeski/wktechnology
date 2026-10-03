// "Ver como": pessoa real com suas permissões; papel em modo de teste sem gravação.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ViewAsOption = { id: string; label: string; detail: string | null };
export type ViewAsOptions = { users: ViewAsOption[]; roles: ViewAsOption[] };
export type ViewAsStart = {
  viewId: string;
  nonce: string;
  tokenHash: string;
  label: string;
  mode: "user" | "role";
  readOnly: boolean;
  expiresAt: string;
};

export const listViewAsOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ViewAsOptions> => {
    const svc = await import("@/lib/view-as.server");
    return svc.listOptions(context.supabase, context.userId);
  });

export const startViewAs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .union([z.object({ user_id: z.string().uuid() }), z.object({ role_id: z.string().uuid() })])
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<ViewAsStart> => {
    const svc = await import("@/lib/view-as.server");
    return svc.start(context.supabase, context.userId, data);
  });

export const bindViewAs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ viewId: z.string().uuid(), nonce: z.string().min(16) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const svc = await import("@/lib/view-as.server");
    const sessionId = (context.claims as { session_id?: string }).session_id ?? null;
    return svc.bind(context.userId, sessionId, data.viewId, data.nonce);
  });

export const endViewAs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ viewId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const svc = await import("@/lib/view-as.server");
    const auth = getRequestHeader("authorization") ?? "";
    const jwt = auth.replace(/^Bearer\s+/i, "");
    return svc.end(context.userId, data.viewId, jwt);
  });
