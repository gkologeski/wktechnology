// Tarefas do usuário (hoje/atrasadas) e leads aguardando trabalho.
import { Link } from "@tanstack/react-router";
import { CheckCircle2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionHeader } from "@/components/techhire/ui";
import { formatDateTime } from "@/lib/crm";
import type { SalesDashboardData, TaskItem } from "@/lib/deals/sales-dashboard.types";

export function TasksPanel({ tasks }: { tasks: TaskItem[] }) {
  const overdue = tasks.filter((t) => t.overdue).length;
  return (
    <section className="rounded-lg border border-border-subtle bg-surface-1 p-4">
      <SectionHeader
        title="Minhas tarefas"
        description={
          overdue > 0 ? `${overdue} atrasada(s) de ${tasks.length} abertas.` : "Próximas pendências."
        }
        action={
          <Link
            to="/tasks"
            className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver todas
          </Link>
        }
      />
      <div className="mt-3">
        {tasks.length === 0 ? (
          <EmptyState
            compact
            icon={CheckCircle2}
            title="Sem tarefas pendentes"
            description="Nenhuma tarefa com prazo definido está aberta para você."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text-primary">{t.subject}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">{formatDateTime(t.dueDate)}</p>
                </div>
                {t.overdue ? (
                  <Badge variant="destructive" className="shrink-0">
                    Atrasada
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function LeadsToWorkPanel({ leads }: { leads: SalesDashboardData["leadsToWork"] }) {
  return (
    <section className="rounded-lg border border-border-subtle bg-surface-1 p-4">
      <SectionHeader
        title="Leads a trabalhar"
        description={`${leads.count} lead(s) sem qualificação concluída.`}
        action={
          <Link
            to="/leads"
            className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Abrir leads
          </Link>
        }
      />
      <div className="mt-3">
        {leads.sample.length === 0 ? (
          <EmptyState
            compact
            icon={UserPlus}
            title="Nenhum lead aguardando"
            description="Todos os leads foram qualificados ou descartados."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle">
            {leads.sample.map((l) => (
              <li key={l.id} className="py-2">
                <Link
                  to="/leads/$id"
                  params={{ id: l.id }}
                  className="flex items-center justify-between gap-3 text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0 truncate text-text-primary">{l.name}</span>
                  <span className="shrink-0 text-xs text-text-tertiary">{l.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
