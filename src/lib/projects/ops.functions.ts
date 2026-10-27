import { requireWorkPermission } from "@/lib/access-control/work-permission.middleware";
// TechProjects — painel de operação (somente administrador ativo): agendamentos esperados, últimas
// execuções e filas do workspace. O banco nunca devolve comando nem segredo de agendamento.
import { createServerFn } from "@tanstack/react-start";
import type { ProjectsOpsStatus } from "./ops.types";

export const getProjectsOps = createServerFn({ method: "GET" })
  .middleware([requireWorkPermission("techprojects.operations", "view")])
  .handler(async ({ context }): Promise<ProjectsOpsStatus> => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    const ws = await resolveActiveWorkspace(context.userId);
    const rpc = (
      context.supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    ).bind(context.supabase);
    const { data, error } = await rpc("project_ops_status", { p_ws: ws });
    if (error) throw new Error(error.message);
    return data as ProjectsOpsStatus;
  });
