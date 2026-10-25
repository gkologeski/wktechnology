import { HrScreenAccess as Order3ScreenAccess } from "@/components/hr-access";
import { createFileRoute } from "@tanstack/react-router";
import { DeliveryPolicyPage } from "@/components/projects/delivery-policy/delivery-policy-page";

export const Route = createFileRoute("/_authenticated/projects/settings/delivery")({
  head: () => ({
    meta: [
      { title: "Entrega de negócios — TechProjects" },
      {
        name: "description",
        content:
          "Política do workspace para criar ou vincular o projeto de entrega quando um negócio é ganho.",
      },
      { property: "og:title", content: "Entrega de negócios — TechProjects" },
      {
        property: "og:description",
        content:
          "Negócio ganho vira projeto em planejamento, sem duplicar e sem reprocessar o histórico.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Order3RouteAccess,
});

const Order3Page = DeliveryPolicyPage;
function Order3RouteAccess() {
  return (
    <Order3ScreenAccess resources={["techprojects.delivery"]}>
      <Order3Page />
    </Order3ScreenAccess>
  );
}
