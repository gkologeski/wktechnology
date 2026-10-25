import { HrScreenAccess as Order3ScreenAccess } from "@/components/hr-access";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/techhire/ui";
import { TimePolicyCard } from "@/components/projects/time-governance/time-policy-card";
import { DeliveryTemplatesCard } from "@/components/projects/time-governance/delivery-templates-card";

export const Route = createFileRoute("/_authenticated/projects/settings/time")({
  head: () => ({
    meta: [
      { title: "Política de horas e modelos — TechProjects" },
      {
        name: "description",
        content:
          "Política versionada de apontamento, aprovação e fechamento, e modelos de entrega por serviço.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Order3RouteAccess,
});

const Order3Page = () => (
  <div className="space-y-6 p-4 pb-10 sm:p-6">
    <PageHeader
      eyebrow="TechProjects · Configurações"
      title="Política de horas e modelos de entrega"
      description="Regras de apontamento, envio, aprovação e fechamento, com histórico de versões; e modelos de entrega ligados aos serviços do catálogo."
    />
    <Order3ScreenAccess resources={["techprojects.time_policy"]}>
      <TimePolicyCard />
    </Order3ScreenAccess>
    <Order3ScreenAccess resources={["techprojects.delivery_templates"]}>
      <DeliveryTemplatesCard />
    </Order3ScreenAccess>
  </div>
);
function Order3RouteAccess() {
  return (
    <Order3ScreenAccess resources={["techprojects.time_policy", "techprojects.delivery_templates"]}>
      <Order3Page />
    </Order3ScreenAccess>
  );
}
