// Botão "Sala agora" da barra de ações: cria uma reunião por vídeo instantânea
// vinculada ao registro atual.
// Extraído de `activity-timeline.tsx` sem mudança de comportamento.
import { Video, Zap } from "lucide-react";
import { StartVideoButton } from "@/components/meetings/start-video-button";
import type { RelatedKey } from "@/components/activity/timeline-shared";

const VIDEO_ENTITY: Partial<Record<RelatedKey, "contact" | "lead" | "deal">> = {
  related_contact_id: "contact",
  related_lead_id: "lead",
  related_deal_id: "deal",
};

export function InstantRoomButton({
  relatedKey,
  relatedId,
  targetName,
  onCreated,
}: {
  relatedKey: RelatedKey;
  relatedId: string;
  targetName?: string;
  onCreated: () => void;
}) {
  const videoEntity = VIDEO_ENTITY[relatedKey];

  return (
    <StartVideoButton
      entity={videoEntity}
      entityId={videoEntity ? relatedId : undefined}
      defaultTitle={targetName ? `Reunião com ${targetName}` : "Reunião por vídeo"}
      onCreated={onCreated}
      renderTrigger={(openDialog) => (
        <button
          type="button"
          title="Criar sala de reunião por vídeo"
          onClick={openDialog}
          className="flex flex-col items-center gap-1.5 w-16 shrink-0 group"
        >
          <span className="relative flex items-center justify-center h-12 w-12 rounded-full border border-primary/40 bg-gradient-to-br from-primary to-purple-500 text-primary-foreground shadow-md shadow-primary/30 transition-transform group-hover:scale-105">
            <Video className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 flex items-center justify-center h-4 w-4 rounded-full bg-amber-400 text-amber-950 border-2 border-card">
              <Zap className="h-2.5 w-2.5" fill="currentColor" />
            </span>
          </span>
          <span className="text-[11px] font-semibold text-primary text-center leading-tight">
            Sala agora
          </span>
        </button>
      )}
    />
  );
}
