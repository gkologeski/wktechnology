// Lista de fontes de importação do TechProjects.
import { Link } from "@tanstack/react-router";
import { ArrowRight, Fingerprint, Timer } from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/techhire/ui";

export function ProjectsImportsHub() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="TechProjects · Configurações"
        title="Importações"
        description="Traga projetos e horas de outras ferramentas. Toda importação passa por uma prévia conferida antes de gravar."
      />
      <ul className="grid gap-4 sm:grid-cols-2">
        <li>
          <Link
            to="/projects/settings/imports/clockify"
            className="group flex h-full items-start gap-3 rounded-lg border border-border-subtle bg-surface-1 p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Abrir o importador do Clockify"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
              <Timer className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-medium">Clockify</span>
                <StatusBadge status="open" label="Disponível" />
              </span>
              <span className="mt-1 block text-sm text-text-secondary">
                Clientes, projetos (inclusive arquivados), tarefas, pessoas e horas com segundos
                exatos.
              </span>
            </span>
            <ArrowRight
              className="mt-1 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary"
              aria-hidden
            />
          </Link>
        </li>
        <li>
          <Link
            to="/projects/settings/imports/jibble"
            className="group flex h-full items-start gap-3 rounded-lg border border-border-subtle bg-surface-1 p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Abrir o importador do Jibble"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
              <Fingerprint className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-medium">Jibble</span>
                <StatusBadge status="open" label="Disponível" />
              </span>
              <span className="mt-1 block text-sm text-text-secondary">
                Pessoas, projetos, atividades e eventos de ponto reconstruídos em intervalos, com
                conciliação de timesheets e checagem de duplicidade com o Clockify.
              </span>
            </span>
            <ArrowRight
              className="mt-1 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary"
              aria-hidden
            />
          </Link>
        </li>
      </ul>
    </div>
  );
}
