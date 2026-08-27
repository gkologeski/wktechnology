// Próximas reuniões (7 dias): reuniões internas + agendamentos confirmados.
import { CalendarClock, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionHeader } from "@/components/techhire/ui";
import { formatDateTime } from "@/lib/crm";
import type { MeetingItem } from "@/lib/deals/sales-dashboard.types";

export function MeetingsAgenda({ meetings }: { meetings: MeetingItem[] }) {
  return (
    <section className="rounded-lg border border-border-subtle bg-surface-1 p-4">
      <SectionHeader title="Próximas reuniões" description="Próximos 7 dias." />
      <div className="mt-3">
        {meetings.length === 0 ? (
          <EmptyState
            compact
            icon={CalendarClock}
            title="Nenhuma reunião agendada"
            description="Reuniões internas e agendamentos confirmados dos próximos 7 dias aparecem aqui."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle">
            {meetings.map((m) => (
              <li key={`${m.kind}-${m.id}`} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{m.title}</p>
                  <p className="mt-0.5 truncate text-xs text-text-secondary">
                    {formatDateTime(m.startAt)}
                    {m.subtitle ? ` · ${m.subtitle}` : ""}
                  </p>
                </div>
                {m.link ? (
                  <Button asChild size="sm" variant="outline" className="shrink-0">
                    <a href={m.link} target="_blank" rel="noreferrer">
                      <Video className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Entrar
                    </a>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
