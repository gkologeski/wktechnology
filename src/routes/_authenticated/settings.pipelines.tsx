import { createFileRoute } from "@tanstack/react-router";
import { CrudSettings } from "@/components/crud-settings";

export const Route = createFileRoute("/_authenticated/settings/pipelines")({
  component: () => (
    <CrudSettings
      table="pipelines"
      title="Pipelines"
      description="Gerencie pipelines e estágios para Leads e Negócios."
      defaults={{ entity: "deal", is_default: false }}
      fields={[
        { name: "name", label: "Nome", required: true },
        { name: "entity", label: "Entidade (deal | lead)", required: true, defaultValue: "deal" },
        { name: "stages", label: "Estágios (JSON array de {value,label,color,probability})", type: "json",
          defaultValue: [{ value: "new", label: "Novo" }, { value: "won", label: "Ganho" }] },
        { name: "is_default", label: "Padrão", type: "switch" },
      ]}
      columns={[
        { key: "name", label: "Nome" },
        { key: "entity", label: "Entidade" },
        { key: "is_default", label: "Padrão", render: (r) => (r as unknown as { is_default: boolean }).is_default ? "Sim" : "Não" },
      ]}
    />
  ),
});
