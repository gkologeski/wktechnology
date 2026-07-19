import { createFileRoute } from "@tanstack/react-router";
import { ProductsPage } from "@/components/products/products-page";

export const Route = createFileRoute("/_authenticated/settings/products")({
  component: ProductsPage,
});
