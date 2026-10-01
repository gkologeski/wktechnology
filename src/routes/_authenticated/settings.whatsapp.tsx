import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plug,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  PageHeader,
  SectionHeader,
  EmptyState,
  Skeletons,
  StatusBadge,
} from "@/components/techhire/ui";
import { WhatsAppIcon } from "@/components/whatsapp/whatsapp-icon";
import {
  getWhatsAppConnection,
  testWhatsAppConnection,
  type WhatsAppConnectionState,
} from "@/lib/whatsapp/connection.functions";

export const Route = createFileRoute("/_authenticated/settings/whatsapp")({
  head: () => ({
    meta: [
      { title: "Conexão do WhatsApp | TechERP" },
      {
        name: "description",
        content: "Gerencie o número do WhatsApp Business conectado ao TechERP.",
      },
      { property: "og:title", content: "Conexão do WhatsApp | TechERP" },
      {
        property: "og:description",
        content: "Painel de conexão do WhatsApp Business usado para enviar e receber mensagens.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WhatsAppSettings,
});

const QUALITY_LABELS: Record<string, string> = {
  GREEN: "Alta",
  YELLOW: "Média",
  RED: "Baixa",
  UNKNOWN: "Não avaliada",
  NA: "Não avaliada",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-text-primary">{value}</p>
    </div>
  );
}

function WhatsAppSettings() {
  const fetchConnection = useServerFn(getWhatsAppConnection);
  const runTest = useServerFn(testWhatsAppConnection);
  const queryClient = useQueryClient();
  const [showSteps, setShowSteps] = useState(false);

  const connection = useQuery<WhatsAppConnectionState>({
    queryKey: ["whatsapp-connection"],
    queryFn: () => fetchConnection(),
  });

  const test = useMutation({
    mutationFn: () => runTest({ data: undefined }),
    onSuccess: (state) => {
      queryClient.setQueryData(["whatsapp-connection"], state);
      if (state.connected) toast.success("Conexão funcionando normalmente.");
      else toast.error(state.error || "A conexão não respondeu.");
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Não foi possível testar a conexão."),
  });

  const data = connection.data;

  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-8">
      <PageHeader
        eyebrow="Configurações"
        title="WhatsApp"
        description="Envio e recebimento de mensagens usam o número conectado abaixo."
        secondaryActions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => connection.refetch()}
            disabled={connection.isFetching}
          >
            {connection.isFetching ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="mr-2 size-4" aria-hidden="true" />
            )}
            Atualizar dados
          </Button>
        }
        primaryAction={
          <Button size="sm" onClick={() => test.mutate()} disabled={test.isPending}>
            {test.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ShieldCheck className="mr-2 size-4" aria-hidden="true" />
            )}
            Testar conexão
          </Button>
        }
      />

      {connection.isLoading ? (
        <Skeletons.Card />
      ) : connection.isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Não foi possível carregar a conexão"
          description="Tente atualizar os dados em alguns instantes."
          action={
            <Button size="sm" variant="outline" onClick={() => connection.refetch()}>
              Tentar novamente
            </Button>
          }
        />
      ) : !data?.configured ? (
        <EmptyState
          icon={Plug}
          title="Nenhum número conectado"
          description="Conecte um número do WhatsApp Business pelo painel de conectores para começar a enviar mensagens."
        />
      ) : (
        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-sunken">
                  <WhatsAppIcon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-text-primary">
                    {data.displayPhoneNumber || "Número indisponível"}
                  </p>
                  <p className="truncate text-sm text-text-secondary">
                    {data.verifiedName || "Nome exibido não informado"}
                  </p>
                </div>
              </div>
              {data.connected ? (
                <StatusBadge status="open" label="Conectado" />
              ) : (
                <StatusBadge status="closed" label="Com falha" />
              )}
            </div>

            {!data.connected && data.error ? (
              <p
                className="rounded-md border border-status-closed/30 bg-status-closed/10 px-3 py-2 text-sm text-status-closed"
                role="alert"
              >
                {data.error}
              </p>
            ) : null}

            <Separator />

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Qualidade da linha"
                value={QUALITY_LABELS[data.qualityRating || "UNKNOWN"] || "Não avaliada"}
              />
              <Field label="Também no aplicativo" value={data.isOnBizApp ? "Sim" : "Não"} />
              <Field label="Tipo de conta" value={data.platformType || "Não informado"} />
            </div>

            <Separator />

            <div className="space-y-3">
              <SectionHeader
                title="Trocar ou desconectar o número"
                description="A troca é feita no painel de conectores; o TechERP passa a mostrar o novo número sozinho."
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSteps((v) => !v)}
                    aria-expanded={showSteps}
                  >
                    {showSteps ? "Ocultar passos" : "Ver passos"}
                  </Button>
                }
              />
              {showSteps ? (
                <ol className="list-decimal space-y-1.5 pl-5 text-sm text-text-secondary">
                  <li>Abra Conectores › WhatsApp Business no painel do Lovable.</li>
                  <li>Para trocar, desconecte o número atual e conecte o novo.</li>
                  <li>
                    Se o número já estiver ligado ao aplicativo WhatsApp Business, desconecte-o
                    primeiro no celular em Configurações › Conta › Plataforma Business.
                  </li>
                  <li>Volte aqui e use “Atualizar dados” para ver o número novo.</li>
                </ol>
              ) : null}
            </div>

            <div className="flex items-start gap-2 rounded-md border border-border-subtle bg-surface-1 px-3 py-2 text-xs text-text-secondary">
              <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                Respostas são livres por 24 horas depois que o cliente escreve. Fora dessa janela, a
                Meta exige um modelo aprovado.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {data?.connected ? (
        <p className="flex items-center gap-2 text-xs text-text-tertiary">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          As mensagens enviadas pelo sistema saem por este número.
        </p>
      ) : null}
    </div>
  );
}
