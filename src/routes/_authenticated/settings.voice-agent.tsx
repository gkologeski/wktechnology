import { createFileRoute, redirect } from "@tanstack/react-router";
import { VoiceAgentPage } from "@/components/prospecting/pages/voice-agent-page";

export const Route = createFileRoute("/_authenticated/settings/voice-agent")({
  beforeLoad: () => {
    throw redirect({ to: "/prospecting", search: { tab: "voice" as const } });
  },
  component: VoiceAgentPage,
});
