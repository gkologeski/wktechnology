import { createFileRoute } from "@tanstack/react-router";
import { MeetingRemindersPage } from "@/components/whatsapp/meeting-reminders-page";

export const Route = createFileRoute("/_authenticated/settings/meeting-reminders")({
  head: () => ({
    meta: [
      { title: "Lembretes de reunião — Configurações | TechERP" },
      {
        name: "description",
        content: "Lembretes automáticos por WhatsApp antes das reuniões com clientes.",
      },
    ],
  }),
  component: MeetingRemindersPage,
});
