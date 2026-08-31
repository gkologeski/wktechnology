import { formatDateTime } from "@/lib/crm";
import { useState, useEffect } from "react";
import { TicketCard } from "./ticket-card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Phone, Building2, User as UserIcon, Calendar, Tag } from "lucide-react";
import { PRIORITIES, STATUSES, type TicketRow } from "./types";
import { ticketResponsibleId, creatorId } from "@/lib/entity/responsible";

export function TicketsSplitView({
  tickets,
  lookups,
  onOpenFull,
}: {
  tickets: TicketRow[];
  lookups: {
    contacts: Map<string, string>;
    companies: Map<string, string>;
    owners: Map<string, string>;
  };
  onOpenFull: (t: TicketRow) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(tickets[0]?.id ?? null);
  useEffect(() => {
    if (!tickets.find((t) => t.id === selectedId)) {
      setSelectedId(tickets[0]?.id ?? null);
    }
  }, [tickets, selectedId]);

  const selected = tickets.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-[340px_1fr] gap-0 border rounded-md overflow-hidden bg-card h-[calc(100vh-220px)]">
      {/* Left list */}
      <ScrollArea className="border-r bg-[var(--hs-surface)]">
        <div className="p-2 space-y-1.5">
          {tickets.length === 0 && (
            <p className="text-xs text-[var(--hs-text-muted)] text-center py-8">
              Nenhum ticket nesta view.
            </p>
          )}
          {tickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              draggable={false}
              active={t.id === selectedId}
              contactName={t.contact_id ? lookups.contacts.get(t.contact_id) : undefined}
              companyName={t.company_id ? lookups.companies.get(t.company_id) : undefined}
              ownerName={
                ticketResponsibleId(t)
                  ? lookups.owners.get(ticketResponsibleId(t) as string)
                  : undefined
              }
              onClick={() => setSelectedId(t.id)}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Right preview */}
      <div className="overflow-y-auto">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-sm text-[var(--hs-text-muted)]">
            Selecione um ticket para visualizar.
          </div>
        ) : (
          <div className="p-5 max-w-3xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] text-[var(--hs-text-muted)] uppercase tracking-wide">
                  <Tag className="h-3 w-3" /> Ticket
                </div>
                <h2 className="text-xl font-semibold leading-tight mt-1">{selected.subject}</h2>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">
                    {STATUSES.find((s) => s.value === selected.status)?.label}
                  </Badge>
                  <Badge
                    style={{
                      background: `color-mix(in oklab, var(--priority-${selected.priority}) 18%, transparent)`,
                      color: `var(--priority-${selected.priority})`,
                      borderColor: `color-mix(in oklab, var(--priority-${selected.priority}) 40%, transparent)`,
                    }}
                    variant="outline"
                  >
                    {PRIORITIES.find((p) => p.value === selected.priority)?.label}
                  </Badge>
                  {selected.source && <Badge variant="outline">{selected.source}</Badge>}
                </div>
              </div>
              <button
                onClick={() => onOpenFull(selected)}
                className="text-xs text-[var(--hs-orange)] hover:underline shrink-0"
              >
                Abrir completo →
              </button>
            </div>

            {selected.description && (
              <div className="mt-5 rounded-md border bg-[var(--hs-surface)] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--hs-text-muted)] mb-2">
                  Descrição
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {selected.description}
                </p>
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <Field
                icon={UserIcon}
                label="Contato"
                value={selected.contact_id ? lookups.contacts.get(selected.contact_id) : undefined}
              />
              <Field
                icon={Building2}
                label="Empresa"
                value={selected.company_id ? lookups.companies.get(selected.company_id) : undefined}
              />
              <Field
                icon={UserIcon}
                label="Responsável"
                value={
                  ticketResponsibleId(selected)
                    ? lookups.owners.get(ticketResponsibleId(selected) as string)
                    : "—"
                }
              />
              <Field
                icon={UserIcon}
                label="Criado por"
                value={
                  creatorId(selected)
                    ? (lookups.owners.get(creatorId(selected) as string) ?? "—")
                    : "—"
                }
              />
              <Field
                icon={Calendar}
                label="Vencimento"
                value={selected.due_at ? formatDateTime(selected.due_at) : "—"}
              />
              <Field icon={Mail} label="Fonte" value={selected.source ?? "—"} />
              <Field icon={Phone} label="Criado em" value={formatDateTime(selected.created_at)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-md border p-3 bg-background">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--hs-text-muted)]">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-sm truncate">{value || "—"}</div>
    </div>
  );
}
