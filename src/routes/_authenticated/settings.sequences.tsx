import { createFileRoute } from "@tanstack/react-router";
import { CrudSettings } from "@/components/crud-settings";

export const Route = createFileRoute("/_authenticated/settings/sequences")({
  component: () => (
    <CrudSettings
      table="sequences"
      title="Sequências"
      description="Cadências de tarefas (a execução por worker é separada)."
      defaults={{ entity: "contact", enabled: true }}
      fields={[
        { name: "name", label: "Nome", required: true },
        { name: "entity", label: "Entidade", defaultValue: "contact", required: true },
        { name: "steps", label: "Passos (JSON array de {day, type, subject, body})", type: "json",
          defaultValue: [{ day: 0, type: "email", subject: "Olá", body: "Tudo bem?" }] },
        { name: "enabled", label: "Ativa", type: "switch" },
      ]}
      columns={[
        { key: "name", label: "Nome" },
        { key: "entity", label: "Entidade" },
        { key: "enabled", label: "Ativa", render: (r) => (r as { enabled: boolean }).enabled ? "Sim" : "Não" },
      ]}
    />
  ),
});
