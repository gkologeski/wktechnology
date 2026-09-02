import { lazy, Suspense, type ReactNode } from "react";
import { CompanyCard, ContactsCard } from "./associations/company-cards";
import { DealsCard, TicketsCard } from "./associations/pipeline-cards";
import { AttachmentsCard, EmailsCard, TasksCard } from "./associations/misc-cards";

// Cards exclusivos de lead/ticket: carregados sob demanda, só na entidade
// correspondente (code-splitting real por tipo de registro).
const LeadContactsCard = lazy(() =>
  import("./associations/lead-cards").then((m) => ({ default: m.LeadContactsCard })),
);
const LeadDealsCard = lazy(() =>
  import("./associations/lead-cards").then((m) => ({ default: m.LeadDealsCard })),
);
const RecordLeadsCard = lazy(() =>
  import("./associations/lead-cards").then((m) => ({ default: m.RecordLeadsCard })),
);
const SingleContactCard = lazy(() =>
  import("./associations/company-cards").then((m) => ({ default: m.SingleContactCard })),
);
const SingleDealCard = lazy(() =>
  import("./associations/company-cards").then((m) => ({ default: m.SingleDealCard })),
);

// Cards extras do lead (formulários, agendamentos, e-mails, campanhas, prospecção)
// e o card de "Lead de origem" exibido no negócio.
const LeadFormSubmissionsCard = lazy(() =>
  import("./associations/lead-extra-cards").then((m) => ({ default: m.LeadFormSubmissionsCard })),
);
const LeadBookingsCard = lazy(() =>
  import("./associations/lead-extra-cards").then((m) => ({ default: m.LeadBookingsCard })),
);
const LeadEmailThreadsCard = lazy(() =>
  import("./associations/lead-extra-cards").then((m) => ({ default: m.LeadEmailThreadsCard })),
);
const LeadBroadcastsCard = lazy(() =>
  import("./associations/lead-extra-cards").then((m) => ({ default: m.LeadBroadcastsCard })),
);
const LeadProspectingCard = lazy(() =>
  import("./associations/lead-extra-cards").then((m) => ({ default: m.LeadProspectingCard })),
);
const DealOriginLeadCard = lazy(() =>
  import("./associations/lead-extra-cards").then((m) => ({ default: m.DealOriginLeadCard })),
);
const MeetingsPanel = lazy(() =>
  import("@/components/meetings/meetings-panel").then((m) => ({ default: m.MeetingsPanel })),
);
const CallHistoryPanel = lazy(() =>
  import("@/components/voice/call-history-panel").then((m) => ({ default: m.CallHistoryPanel })),
);


export type AssociationEntity = "contact" | "lead" | "company" | "deal" | "ticket";

type Props = {
  entity: AssociationEntity;
  entityId: string;
  companyId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
};

/** Skeleton com a mesma silhueta de um card de associação. */
function CardFallback() {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3" aria-busy="true">
      <div className="h-4 w-32 rounded bg-muted animate-pulse" />
      <div className="h-10 w-full rounded bg-muted animate-pulse" />
    </div>
  );
}

function LazyCard({ children }: { children: ReactNode }) {
  return <Suspense fallback={<CardFallback />}>{children}</Suspense>;
}

export function AssociationsPanel({ entity, entityId, companyId, contactId, dealId }: Props) {
  return (
    <>
      {(entity === "contact" || entity === "deal" || entity === "ticket" || entity === "lead") && (
        <CompanyCard entity={entity} entityId={entityId} companyId={companyId ?? null} />
      )}
      {(entity === "company" || entity === "deal") && (
        <ContactsCard entity={entity} entityId={entityId} />
      )}
      {entity === "lead" && (
        <LazyCard>
          <LeadContactsCard entityId={entityId} />
        </LazyCard>
      )}
      {entity === "ticket" && (
        <LazyCard>
          <SingleContactCard entityId={entityId} contactId={contactId ?? null} />
        </LazyCard>
      )}
      {(entity === "contact" || entity === "company") && (
        <DealsCard entity={entity} entityId={entityId} companyId={companyId} />
      )}
      {(entity === "contact" || entity === "company") && (
        <LazyCard>
          <RecordLeadsCard entity={entity} entityId={entityId} />
        </LazyCard>
      )}
      {entity === "lead" && (
        <LazyCard>
          <LeadDealsCard entityId={entityId} />
        </LazyCard>
      )}
      {entity === "ticket" && (
        <LazyCard>
          <SingleDealCard entityId={entityId} dealId={dealId ?? null} />
        </LazyCard>
      )}
      {entity !== "lead" && entity !== "ticket" && (
        <TicketsCard entity={entity} entityId={entityId} companyId={companyId} />
      )}
      {entity !== "ticket" && <TasksCard entity={entity} entityId={entityId} />}
      {entity !== "ticket" && <EmailsCard entity={entity} entityId={entityId} />}
      {entity !== "ticket" && <AttachmentsCard entity={entity} entityId={entityId} />}
    </>
  );
}
