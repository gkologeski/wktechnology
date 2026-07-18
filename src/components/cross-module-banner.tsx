import { useMemo } from "react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useActiveModule, usePathModule, setStoredActiveModule } from "@/lib/modules/active-module";
import { MODULES } from "@/lib/modules/registry";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Banner exibido quando a rota atual pertence a um módulo diferente do
 * módulo ativo do usuário. Não bloqueia, apenas orienta:
 *  - "Você está numa tela do TechProjects" (contexto).
 *  - Botão para trocar de módulo (persiste em localStorage e redireciona).
 *  - Botão para voltar ao módulo ativo (rota default).
 */
export function CrossModuleBanner() {
  const active = useActiveModule();
  const path = usePathModule();

  const info = useMemo(() => {
    if (!path || path === active) return null;
    return { active: MODULES[active], visited: MODULES[path] };
  }, [active, path]);

  if (!info) return null;

  return (
    <div
      role="status"
      className={cn(
        "mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200/70 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900",
        "dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
      )}
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="font-medium">Você está numa tela do {info.visited.productName}.</span>{" "}
        <span className="opacity-80">Seu módulo ativo é o {info.active.productName}.</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          asChild
          className="h-7 px-2 text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-500/20"
        >
          <Link to={info.active.defaultRoute}>Voltar para {info.active.productName}</Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 border-amber-300 bg-white text-amber-900 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-transparent dark:text-amber-100"
          onClick={() => setStoredActiveModule(info.visited.id)}
        >
          Ativar {info.visited.productName}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
