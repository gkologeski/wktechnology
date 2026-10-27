import { transportCapabilities } from "@/lib/prospecting/sdr/channel-permissions";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { listCloudConnections } from "@/lib/whatsapp/cloud-connections.functions";
import { getWhatsAppConnection } from "@/lib/whatsapp/connection.functions";
import { listEmailAccounts } from "@/lib/email-accounts.functions";
import type { ServiceAccount } from "@/lib/prospecting/sdr/channel-accounts.functions";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/crm";

const quality: Record<string, string> = {
  GREEN: "Alta",
  YELLOW: "Média",
  RED: "Baixa",
  UNKNOWN: "Não avaliada",
};
/** Uses only existing permission-checked metadata endpoints; no credentials enter this component. */
export function ChannelHealth({ account }: { account: ServiceAccount }) {
  const permissions = usePermissions();
  const { view: canView } = transportCapabilities(
    account.channel,
    permissions,
    account.workspace_id,
  );
  const waView = account.channel === "whatsapp" && canView;
  const emailView = account.channel === "email" && canView;
  const cloudFn = useServerFn(listCloudConnections);
  const legacyFn = useServerFn(getWhatsAppConnection);
  const emailFn = useServerFn(listEmailAccounts);
  const cloud = useQuery({
    queryKey: ["wa-cloud-connections", permissions.workspaceId],
    queryFn: () => cloudFn(),
    enabled: account.channel === "whatsapp" && waView,
    staleTime: 30000,
  });
  const cloudData = cloud.data as
    | {
        numbers: {
          phone_number_id: string;
          connection_id: string;
          available: boolean;
          quality_rating: string | null;
        }[];
        connections: {
          id: string;
          enabled: boolean;
          webhook_verified_at: string | null;
          synced_at: string | null;
        }[];
      }
    | undefined;
  const number = cloudData?.numbers.find((item) => item.phone_number_id === account.source_key);
  const connection = number
    ? cloudData?.connections.find((item) => item.id === number.connection_id)
    : undefined;
  const legacy = useQuery({
    queryKey: ["whatsapp-connection", permissions.workspaceId],
    queryFn: () => legacyFn(),
    enabled: account.channel === "whatsapp" && waView && cloud.isSuccess && !number,
    staleTime: 30000,
  });
  const emails = useQuery({
    queryKey: ["email_accounts", permissions.workspaceId],
    queryFn: () => emailFn(),
    enabled: account.channel === "email" && emailView,
    staleTime: 30000,
  });
  if (account.channel === "chat")
    return canView ? (
      <p className="text-xs text-muted-foreground">
        Widget disponível. Confira a instalação no site em “Configurar conexão”.
      </p>
    ) : null;
  if ((account.channel === "whatsapp" && !waView) || (account.channel === "email" && !emailView))
    return (
      <p className="text-xs text-muted-foreground">
        Status da conexão exige permissão de visualização do canal.
      </p>
    );
  if (account.channel === "email") {
    if (emails.isPending)
      return <p className="text-xs text-muted-foreground">Consultando conexão…</p>;
    if (emails.isError)
      return (
        <p className="text-xs text-destructive">Não foi possível consultar a conexão de e-mail.</p>
      );
    const mailbox = emails.data.items.find((item) => item.id === account.source_key);
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant={mailbox?.status === "connected" ? "outline" : "secondary"}>
          {mailbox?.status === "connected"
            ? "E-mail conectado"
            : "Conta indisponível ou requer reconexão"}
        </Badge>
        {mailbox?.last_sync_at && (
          <span className="text-muted-foreground">
            Última sincronização: {formatDateTime(mailbox.last_sync_at)}
          </span>
        )}
      </div>
    );
  }
  if (cloud.isPending || (!number && legacy.isPending && cloud.isSuccess))
    return <p className="text-xs text-muted-foreground">Consultando conexão…</p>;
  if (cloud.isError || (!number && legacy.isError))
    return (
      <p className="text-xs text-destructive">Não foi possível consultar a conexão WhatsApp.</p>
    );
  if (number)
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">
          {connection?.enabled && number.available
            ? "Meta configurada"
            : "Conexão Meta indisponível"}
        </Badge>
        <span>Qualidade: {quality[number.quality_rating ?? "UNKNOWN"] ?? "Não avaliada"}</span>
        <span className="text-muted-foreground">
          {connection?.webhook_verified_at ? "Webhook validado" : "Webhook pendente"}
        </span>
        {connection?.synced_at && (
          <span className="text-muted-foreground">
            Última consulta: {formatDateTime(connection.synced_at)}
          </span>
        )}
      </div>
    );
  const matches = legacy.data?.connected && legacy.data.phoneNumberId === account.source_key;
  return (
    <Badge variant={matches ? "outline" : "secondary"}>
      {matches ? "Conexão Lovable validada" : "Número não disponível na conexão Lovable atual"}
    </Badge>
  );
}
