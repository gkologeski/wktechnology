import { Link } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { PIPELINES_MANAGE } from "@/lib/access-control/admin-permission-keys";
import { cn } from "@/lib/utils";

/**
 * Atalho discreto para configurar os substatus da etapa quando ela ainda não
 * possui nenhum cadastrado. Só é exibido para quem pode gerenciar pipelines;
 * para os demais usuários, nada é renderizado (comportamento anterior).
 */
export function SubstatusManageHint({
  className,
  onClick,
}: {
  className?: string;
  /** Intercepta o clique (ex.: cards de Kanban não devem navegar/abrir o registro). */
  onClick?: (e: React.MouseEvent) => void;
}) {
  const { canAny } = usePermissions();
  if (!canAny(PIPELINES_MANAGE)) return null;

  return (
    <Link
      to="/settings/pipelines"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
        className,
      )}
    >
      <Settings2 className="h-3 w-3" aria-hidden="true" />
      Configurar substatus desta etapa
    </Link>
  );
}
