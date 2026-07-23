import { createFileRoute } from "@tanstack/react-router";
import { CrudSettings } from "@/components/crud-settings";

export function PlaybooksPage() {
  return (
    <CrudSettings
      table="playbooks"
      title="Playbooks"
      description="Roteiros de qualificação e descoberta para a equipe."
      defaults={{ entity: "lead", enabled: true }}
      fields={[
        { name: "name", label: "Nome", required: true },
        { name: "entity", label: "Entidade", defaultValue: "lead", required: true },
        {
          name: "content",
          label: "Perguntas (JSON array)",
          type: "json",
          defaultValue: [{ id: "q1", question: "Qual o tamanho da empresa?", type: "text" }],
        },
        { name: "enabled", label: "Ativo", type: "switch" },
      ]}
      columns={[
        { key: "name", label: "Nome" },
        { key: "entity", label: "Entidade" },
        {
          key: "enabled",
          label: "Ativo",
          render: (r) => ((r as unknown as { enabled: boolean }).enabled ? "Sim" : "Não"),
        },
      ]}
    />
  );
}

export const Route = createFileRoute("/_authenticated/settings/playbooks")({
  component: PlaybooksPage,
});
