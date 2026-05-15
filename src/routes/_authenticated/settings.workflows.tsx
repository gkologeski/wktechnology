import { createFileRoute } from "@tanstack/react-router";
import { CrudSettings } from "@/components/crud-settings";

export const Route = createFileRoute("/_authenticated/settings/workflows")({
  component: () => (
    <CrudSettings
      table="workflows"
      title="Workflows"
      description="Automações disparadas por eventos. Triggers e ações em JSON."
      defaults={{ entity: "lead", enabled: true }}
      fields={[
        { name: "name", label: "Nome", required: true },
        { name: "entity", label: "Entidade", defaultValue: "lead", required: true },
        { name: "trigger", label: "Trigger (JSON)", type: "json",
          defaultValue: { event: "created" } },
        { name: "actions", label: "Ações (JSON array)", type: "json",
          defaultValue: [{ type: "set_field", field: "status", value: "contacted" }] },
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
