import { createFileRoute } from "@tanstack/react-router";
import { BrandingBuilder } from "@/components/branding/branding-builder";

export const Route = createFileRoute("/_authenticated/settings/branding")({
  component: BrandingPage,
});

function BrandingPage() {
  return (
    <div className="p-4">
      <BrandingBuilder />
    </div>
  );
}
