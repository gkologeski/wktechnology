import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { EmailConfiguration } from "@/components/service-channels/email-configuration";
const searchSchema = z.object({ gmail: z.string().optional() });
export const Route = createFileRoute("/_authenticated/settings/email")({
  validateSearch: searchSchema,
  component: EmailSettings,
});
function EmailSettings() {
  const { gmail } = Route.useSearch();
  return <EmailConfiguration oauthStatus={gmail} />;
}
