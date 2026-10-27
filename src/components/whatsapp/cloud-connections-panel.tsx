import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  listCloudConnections,
  createCloudConnection,
  syncCloudConnection,
  setCloudConnectionEnabled,
  subscribeCloudConnection,
} from "@/lib/whatsapp/cloud-connections.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export function CloudConnectionsPanel() {
  const permissions = usePermissions();
  const canView = permissions.can("system.whatsapp.view.workspace");
  const canManage = permissions.can("system.whatsapp.manage.workspace");
  const list = useServerFn(listCloudConnections);
  const create = useServerFn(createCloudConnection);
  const sync = useServerFn(syncCloudConnection);
  const toggle = useServerFn(setCloudConnectionEnabled);
  const subscribe = useServerFn(subscribeCloudConnection);
  const queryClient = useQueryClient();
  const key = ["wa-cloud-connections", permissions.workspaceId];
  const query = useQuery({ queryKey: key, queryFn: () => list(), enabled: canView });
  const empty = {
    label: "",
    wabaId: "",
    apiVersion: "",
    accessToken: "",
    appSecret: "",
    verifyToken: "",
  };
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const subscription = useMutation({
    mutationFn: (id: string) => subscribe({ data: { id } }),
    onSuccess: () => {
      void refresh();
      toast.success(
        "Aplicativo inscrito. Envie uma mensagem de teste para um dos novos números e atualize a conexão.",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const activation = useMutation({
    mutationFn: (data: { id: string; enabled: boolean }) => toggle({ data }),
    onSuccess: () => {
      void refresh();
      toast.success("Situação da conexão atualizada.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const save = useMutation({
    mutationFn: () => create({ data: form }),
    onSuccess: () => {
      setForm(empty);
      setOpen(false);
      void refresh();
      toast.success("Conexão cadastrada. Sincronize os números para conferir a conta.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const synchronize = useMutation({
    mutationFn: (id: string) => sync({ data: { id } }),
    onSuccess: () => {
      void refresh();
      toast.success("Números sincronizados.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (!canView) return null;
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Conexões diretas com a Meta</h2>
            <p className="text-sm text-muted-foreground">
              Cadastre sua conta oficial e consulte os números disponíveis.
            </p>
          </div>
          <Button disabled={!canManage} variant="outline" onClick={() => setOpen(!open)}>
            Adicionar conexão
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          O número atual continua atendendo pelo conector Lovable e não será migrado
          automaticamente. Novas conexões precisam receber um evento assinado antes da ativação.
        </p>
        {open && canManage && (
          <form
            className="grid gap-3 md:grid-cols-2"
            autoComplete="off"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            {(
              [
                ["label", "Nome da conexão", false],
                ["wabaId", "ID da conta WhatsApp Business (WABA)", false],
                ["apiVersion", "Versão da Graph API (ex.: v23.0)", false],
                ["accessToken", "Token de acesso da Meta", true],
                ["appSecret", "Segredo do aplicativo Meta", true],
                ["verifyToken", "Token de verificação do webhook (mínimo 32 caracteres)", true],
              ] as const
            ).map(([field, label, secret]) => (
              <div key={field} className="space-y-1">
                <Label htmlFor={`cloud-${field}`}>{label}</Label>
                <Input
                  id={`cloud-${field}`}
                  type={secret ? "password" : "text"}
                  autoComplete={secret ? "new-password" : "off"}
                  required
                  value={form[field]}
                  onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                />
              </div>
            ))}
            <p className="text-sm text-muted-foreground md:col-span-2">
              As credenciais são cifradas no servidor e não serão exibidas após salvar. Use a versão
              configurada no seu aplicativo Meta.
            </p>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Validando…" : "Validar e cadastrar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setForm(empty);
                setOpen(false);
              }}
            >
              Cancelar
            </Button>
          </form>
        )}
        {query.isPending && <p>Carregando conexões…</p>}
        {query.isError && (
          <div role="alert">
            <p>Não foi possível carregar a central de conexões.</p>
            <Button variant="outline" onClick={() => query.refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}
        {query.data?.connections.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma conexão direta cadastrada.</p>
        )}
        {query.data?.connections.map((connection: any) => (
          <div key={connection.id} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-medium">{connection.label}</h3>
                <p className="text-sm text-muted-foreground">
                  WABA {connection.waba_id} ·{" "}
                  {connection.enabled ? "Ativa" : "Em preparação / desativada"}
                </p>
              </div>
              <Button
                variant="outline"
                disabled={!canManage || synchronize.isPending}
                onClick={() => synchronize.mutate(connection.id)}
              >
                Sincronizar números
              </Button>
            </div>
            <p className="break-all text-xs text-muted-foreground">
              Webhook: {typeof window !== "undefined" ? window.location.origin : ""}
              /api/public/whatsapp/cloud/{connection.id}
            </p>
            <p className="text-sm text-muted-foreground">
              Na Meta, configure este endereço com o token de verificação informado no cadastro,
              assine o campo messages e envie um evento de teste. Verificação:{" "}
              {connection.webhook_verified_at ? "confirmada" : "pendente"}. Evento assinado:{" "}
              {connection.webhook_received_at ? "recebido" : "pendente"}.
            </p>
            <Button
              variant="outline"
              disabled={
                !canManage ||
                activation.isPending ||
                (!connection.enabled && (!connection.webhook_received_at || !connection.synced_at))
              }
              onClick={() => activation.mutate({ id: connection.id, enabled: !connection.enabled })}
            >
              {connection.enabled ? "Desativar conexão" : "Ativar conexão"}
            </Button>
            <Button
              variant="outline"
              disabled={!canManage || !connection.webhook_verified_at || subscription.isPending}
              onClick={() => subscription.mutate(connection.id)}
            >
              Assinar eventos da conta
            </Button>
            <Button variant="ghost" onClick={() => refresh()}>
              Atualizar situação
            </Button>
            {query.data.numbers
              .filter((number: any) => number.connection_id === connection.id)
              .map((number: any) => (
                <div
                  key={number.phone_number_id}
                  className="flex flex-wrap justify-between gap-2 border-t pt-2 text-sm"
                >
                  <span>
                    {number.display_phone_number} · {number.verified_name || "Sem nome verificado"}
                  </span>
                  <span>
                    Qualidade:{" "}
                    {({ GREEN: "Alta", YELLOW: "Média", RED: "Baixa" } as Record<string, string>)[
                      number.quality_rating
                    ] || "Não avaliada"}{" "}
                    · {number.available ? number.status || "Consultar Meta" : "Indisponível"}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
