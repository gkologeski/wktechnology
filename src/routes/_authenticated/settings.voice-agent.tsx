import { createFileRoute } from "@tanstack/react-router";
import { VoiceAgentPage } from "@/components/prospecting/pages/voice-agent-page";

// Configuração do agente de voz fica em Configurações (antes: aba "voice" da Prospecção).
export const Route = createFileRoute("/_authenticated/settings/voice-agent")({
  head: () => ({
    meta: [
      { title: "Agente de voz — Configurações | TechERP" },
      { name: "description", content: "Configuração do agente de voz usado nas campanhas de ligação." },
    ],
  }),
  component: VoiceAgentPage,
});
