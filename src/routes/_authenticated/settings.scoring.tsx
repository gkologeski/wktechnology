import { createFileRoute } from "@tanstack/react-router";
import { CrudSettings } from "@/components/crud-settings";

export const Route = createFileRoute("/_authenticated/settings/scoring")({
  component: () => (
    <CrudSettings
      table="scoring_rules"
      title="Lead Scoring"
      description="Regras que somam pontos quando uma condição é atendida."
      defaults={{ entity: "lead", enabled: true }}
      fields={[
        { name: "name", label: "Nome da regra", required: true },
        { name: "entity", label: "Entidade (lead | contact | company)", defaultValue: "lead", required: true },
        { name: "condition", label: "Condição (JSON: {field, op, value})", type: "json",
          defaultValue: { field: "source", op: "eq", value: "site" } },
        { name: "points", label: "Pontos", type: "number", defaultValue: 10 },
        { name: "enabled", label: "Ativa", type: "switch" },
      ]}
      columns={[
        { key: "name", label: "Nome" },
        { key: "entity", label: "Entidade" },
        { key: "points", label: "Pontos" },
        { key: "enabled", label: "Ativa", render: (r) => (r as unknown as { enabled: boolean }).enabled ? "Sim" : "Não" },
      ]}
    />
  ),
});
