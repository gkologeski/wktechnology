import { createFileRoute } from "@tanstack/react-router";
import { CrudSettings } from "@/components/crud-settings";

export const Route = createFileRoute("/_authenticated/settings/subscriptions")({
  component: () => (
    <CrudSettings
      table="subscription_types"
      title="Tipos de Assinatura"
      description="Categorias de comunicação para conformidade LGPD/GDPR."
      fields={[
        { name: "name", label: "Nome", required: true, placeholder: "Newsletter mensal" },
        { name: "description", label: "Descrição", type: "textarea" },
      ]}
      columns={[
        { key: "name", label: "Nome" },
        { key: "description", label: "Descrição" },
      ]}
    />
  ),
});
