// Diálogos disparados pela barra de ações da timeline (reunião, e-mail,
// ligação, WhatsApp, pesquisa).
// Extraído de `activity-timeline.tsx` sem mudança de comportamento.
import { lazy, Suspense } from "react";
import { toast } from "sonner";
import { MeetingDialog } from "@/components/meetings/meeting-dialog";
import { SendEmailDialog } from "@/components/email/send-email-dialog";
import { SendWhatsAppDialog } from "@/components/whatsapp/send-whatsapp-dialog";
import { SurveyActivityDialog } from "@/components/surveys/survey-activity-dialog";
import type { CreateAction, RelatedKey } from "@/components/activity/timeline-shared";
import type { TimelineTarget } from "@/lib/timeline/activity-entities";

// O discador carrega o SDK de voz da Twilio; só baixamos esse código quando o
// usuário abre a ação de ligação pela primeira vez.
const CallDialer = lazy(() =>
  import("@/components/voice/call-dialer").then((m) => ({ default: m.CallDialer })),
);

export function TimelineActionDialogs({
  openAction,
  onClose,
  relatedKey,
  relatedId,
  target,
  dialerMounted,
  onRefresh,
}: {
  openAction: CreateAction | null;
  onClose: () => void;
  relatedKey: RelatedKey;
  relatedId: string;
  target: TimelineTarget;
  dialerMounted: boolean;
  onRefresh: () => void;
}) {
  const close = (v: boolean) => {
    if (!v) onClose();
  };

  const missingPhone = (openAction === "call" || openAction === "whatsapp") && !target.phone;
  if (missingPhone) {
    toast.error("Sem telefone disponível para esta entidade.");
    setTimeout(onClose, 0);
  }

  return (
    <>
      <MeetingDialog
        open={openAction === "meeting"}
        onOpenChange={close}
        defaultAttendee={target.email ?? ""}
        relatedKey={relatedKey}
        relatedId={relatedId}
        onCreated={onRefresh}
      />
      <SendEmailDialog
        open={openAction === "email"}
        onOpenChange={close}
        defaultTo={target.email ?? ""}
        contactId={target.contactId}
        leadId={relatedKey === "related_lead_id" ? relatedId : undefined}
        dealId={relatedKey === "related_deal_id" ? relatedId : undefined}
        companyId={relatedKey === "related_company_id" ? relatedId : undefined}
        contactName={target.name}
        onSent={onRefresh}
      />
      {target.phone && dialerMounted && (
        <Suspense fallback={null}>
          <CallDialer
            open={openAction === "call"}
            onOpenChange={close}
            defaultTo={target.phone}
            contactId={target.contactId}
            contactName={target.name}
          />
        </Suspense>
      )}
      {target.phone && (
        <SendWhatsAppDialog
          open={openAction === "whatsapp"}
          onOpenChange={close}
          defaultTo={target.phone}
          contactId={target.contactId}
          contactName={target.name}
        />
      )}
      <SurveyActivityDialog
        open={openAction === "survey"}
        onOpenChange={close}
        relatedKey={relatedKey}
        relatedId={relatedId}
        onSaved={onRefresh}
      />
    </>
  );
}
