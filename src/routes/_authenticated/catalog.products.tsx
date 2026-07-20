import { createFileRoute } from "@tanstack/react-router";
import { ProductsPage } from "@/components/products/products-page";

// Ponto de entrada canônico do Catálogo de Produtos (entidade global do Core ERP).
// Renderiza no layout autenticado padrão para preservar o sidebar do módulo ativo,
// igual a Empresas (/companies) e Contatos (/contacts).
export const Route = createFileRoute("/_authenticated/catalog/products")({
  component: ProductsPage,
});
