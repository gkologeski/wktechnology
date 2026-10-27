import { createFileRoute } from "@tanstack/react-router";
import { handleCloudWebhook } from "@/lib/whatsapp/cloud-webhook.server";

export const Route = createFileRoute("/api/public/whatsapp/cloud/$connectionId")({
  server: {
    handlers: {
      GET: ({ request, params }) => handleCloudWebhook(request, params.connectionId),
      POST: ({ request, params }) => handleCloudWebhook(request, params.connectionId),
    },
  },
});
