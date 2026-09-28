import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { CHANNEL_SETUP, type SendChannel } from "@/lib/channel-availability";
import { cn } from "@/lib/utils";

/** Engrenagem colorida que leva à tela de configuração do canal. */
export function ChannelSetupGear({
  channel,
  className,
}: {
  channel: SendChannel;
  className?: string;
}) {
  const setup = CHANNEL_SETUP[channel];
  return (
    <Link
      to={setup.to}
      aria-label={`Configurar ${setup.label}`}
      title={`Configurar ${setup.label}`}
      draggable={false}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-full bg-warning text-warning-foreground shadow-sm ring-2 ring-background transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Settings className="h-3 w-3" aria-hidden />
    </Link>
  );
}
