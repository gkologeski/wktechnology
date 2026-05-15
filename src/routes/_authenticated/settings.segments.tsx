import { createFileRoute } from "@tanstack/react-router";
import { CrudSettings } from "@/components/crud-settings";

export const Route = createFileRoute("/_authenticated/settings/segments")({
  component: () => (
    <CrudSettings
      table="segments"
      title="Segmentos"
      description="Listas estáticas e dinâmicas baseadas em filtros."
      defaults={{ entity: "contact", kind: "static" }}
      fields={[
        { name: "name", label: "Nome", required: true },
        { name: "entity", label: "Entidade (contact | lead | company | deal)", defaultValue: "contact", required: true },
        { name: "kind", label: "Tipo (static | dynamic)", defaultValue: "static" },
        { name: "filters", label: "Filtros (JSON)", type: "json",
          defaultValue: { op: "and", conditions: [] } },
      ]}
      columns={[
        { key: "name", label: "Nome" },
        { key: "entity", label: "Entidade" },
        { key: "kind", label: "Tipo" },
      ]}
    />
  ),
});
