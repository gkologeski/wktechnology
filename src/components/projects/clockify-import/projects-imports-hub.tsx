// Entrada única de importações; o contexto delimita estado e cache por ator/workspace.
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { IMPORT_PROVIDERS } from "@/lib/projects/imports/import-journey";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { ImportJourneyPage } from "../imports/import-journey-page";

export function ProjectsImportsHub() {
  const { user } = useAuth();
  const p = usePermissions();
  const workspaceId = p.workspaceId;
  if (
    !p.isLoading &&
    !p.isError &&
    !p.canAny(
      IMPORT_PROVIDERS.map((provider) => `techprojects.${provider}_import.view.workspace`),
    ) &&
    p.can("techprojects.reconciliation.view.workspace")
  )
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Importações</h1>
        <p className="text-sm text-muted-foreground">
          Seu perfil tem acesso à Conciliação de horas. A consulta e a execução de cada importador
          exigem autorização própria.
        </p>
        <Button asChild>
          <Link to="/projects/settings/imports/reconciliation">Abrir Conciliação de horas</Link>
        </Button>
      </section>
    );
  return <ImportJourneyPage key={`${workspaceId ?? ""}:${user?.id ?? ""}`} />;
}
