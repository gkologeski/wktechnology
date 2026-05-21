import { createFileRoute } from "@tanstack/react-router";
import { EntityList } from "@/components/entity-list";
import { ACTIVITY_TYPES, formatDateTime } from "@/lib/crm";
import { htmlToPlain } from "@/components/rich-html-editor";
import type { Activity } from "@/lib/db-types";

const COMM_TYPES = ["call", "email", "meeting"] as const;

export const Route = createFileRoute("/_authenticated/communications")({
  component: CommunicationsPage,
});

function CommunicationsPage() {
  return (
    <EntityList<Activity>
      table="activities"
      title="Comunicações"
      description="Ligações, e-mails e reuniões — como o HubSpot."
      entitySingularLabel="comunicação"
      lockedFilters={[{ type: "condition", field: "type", op: "in", value: COMM_TYPES as unknown as string[] }]}
      searchKeys={["subject", "body"]}
      inlineEditable={["type", "subject"]}
      columns={[
        { key: "type", label: "Tipo", render: (r) => ACTIVITY_TYPES.find((t) => t.value === r.type)?.label ?? r.type },
        { key: "subject", label: "Assunto", render: (r) => r.subject || "(sem assunto)" },
        { key: "outcome", label: "Resultado", render: (r) => r.outcome ?? r.meeting_outcome ?? r.disposition ?? "—" },
        { key: "duration_ms", label: "Duração", render: (r) => (r.duration_ms ? `${Math.round(r.duration_ms / 1000 / 60)} min` : "—") },
        { key: "created_at", label: "Quando", render: (r) => formatDateTime(r.created_at) },
      ]}
      fields={[
        { name: "type", label: "Tipo", type: "select", required: true, options: COMM_TYPES.map((t) => ({ value: t, label: ACTIVITY_TYPES.find((a) => a.value === t)!.label })) },
        { name: "subject", label: "Assunto" },
        { name: "body", label: "Conteúdo", type: "html" },
        { name: "outcome", label: "Resultado" },
        { name: "meeting_location", label: "Local (reunião)" },
        { name: "recording_url", label: "URL da gravação (call)" },
      ]}
      defaults={{ type: "call" } as Partial<Activity>}
      filterFields={[
        { name: "type", label: "Tipo", type: "select", options: COMM_TYPES.map((t) => ({ value: t, label: ACTIVITY_TYPES.find((a) => a.value === t)!.label })) },
      ]}
    />
  );
}
