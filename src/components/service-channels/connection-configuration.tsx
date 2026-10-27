import { transportCapabilities } from "@/lib/prospecting/sdr/channel-permissions";
import { lazy, Suspense } from "react";
import type { ServiceChannel } from "@/lib/prospecting/sdr/channel-identity";
import { usePermissions } from "@/lib/access-control/use-permissions";
const WhatsApp = lazy(() =>
  import("./whatsapp-configuration").then((module) => ({ default: module.WhatsAppConfiguration })),
);
const Email = lazy(() =>
  import("./email-configuration").then((module) => ({ default: module.EmailConfiguration })),
);
const Chat = lazy(() =>
  import("./widget-configuration").then((module) => ({ default: module.ChatConfiguration })),
);

export function ConnectionConfiguration({ channel }: { channel: ServiceChannel }) {
  const permissions = usePermissions();
  const { view: canView } = transportCapabilities(channel, permissions);
  if (!canView)
    return (
      <p className="text-sm text-muted-foreground">
        A configuração desta conexão exige a permissão de visualização do respectivo canal.
      </p>
    );
  return (
    <Suspense fallback={<p role="status">Carregando configuração da conexão…</p>}>
      {channel === "whatsapp" ? (
        <WhatsApp />
      ) : channel === "email" ? (
        <Email returnTo="/settings/channels" />
      ) : (
        <Chat />
      )}
    </Suspense>
  );
}
