import { createFileRoute, redirect } from "@tanstack/react-router";

// Ponto de entrada canônico do Catálogo de Produtos.
// Hoje a UI de CRUD vive em /settings/products (fonte única). Mantemos a
// URL /catalog/products como caminho estável para o Core ERP; quando a
// UI unificada de Catálogo estiver pronta ela assume esta rota.
export const Route = createFileRoute("/_authenticated/catalog/products")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/products" });
  },
});
