import { createFileRoute } from "@tanstack/react-router";
import { ChatConfiguration } from "@/components/service-channels/widget-configuration";
export const Route = createFileRoute("/_authenticated/settings/widget")({
  component: WidgetSettings,
});
function WidgetSettings() {
  return <ChatConfiguration />;
}
