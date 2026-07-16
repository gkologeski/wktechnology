// Convenção central de query keys por entidade. Mantém consistência entre
// telas de detalhe, listas, componentes compostos e invalidações realtime.
import type { QueryKey } from "@tanstack/react-query";

type Filters = Record<string, unknown> | undefined;

function withFilters(base: string[], filters: Filters): QueryKey {
  return filters ? [...base, filters] : base;
}

export const qk = {
  // Leads
  lead: (id: string): QueryKey => ["leads", id],
  leadList: (filters?: Filters): QueryKey => withFilters(["leads", "list"], filters),

  // Contatos
  contact: (id: string): QueryKey => ["contacts", id],
  contactList: (filters?: Filters): QueryKey => withFilters(["contacts", "list"], filters),

  // Empresas
  company: (id: string): QueryKey => ["companies", id],
  companyList: (filters?: Filters): QueryKey => withFilters(["companies", "list"], filters),

  // Negócios
  deal: (id: string): QueryKey => ["deals", id],
  dealList: (filters?: Filters): QueryKey => withFilters(["deals", "list"], filters),
  dealLineItems: (dealId: string): QueryKey => ["deals", dealId, "line-items"],

  // Chamados
  ticket: (id: string): QueryKey => ["tickets", id],
  ticketList: (filters?: Filters): QueryKey => withFilters(["tickets", "list"], filters),

  // Atividades/timeline
  activities: (relatedKey: string, relatedId: string): QueryKey => [
    "activities",
    { relatedKey, relatedId },
  ],

  // Associações genéricas
  associations: (entity: string, id: string): QueryKey => ["associations", entity, id],

  // CRUD genérico (CrudSettings)
  crudList: (table: string): QueryKey => ["crud", table, "list"],
};
