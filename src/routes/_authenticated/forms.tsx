import { createFileRoute } from "@tanstack/react-router";
import { FormsPage } from "@/components/forms/forms-page";

// Alias no contexto CRM/TechSales para o mesmo editor de formulários que
// vive em /settings/forms. Existe para que o item "Captar › Formulários" do
// menu do TechSales não empurre o usuário para o shell de Configurações do
// TechERP (ver `WORKSPACE_ROUTE_PREFIXES` em module-switcher.tsx).
export const Route = createFileRoute("/_authenticated/forms")({
  component: FormsPage,
});
