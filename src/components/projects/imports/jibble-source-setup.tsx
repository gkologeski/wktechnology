import { useImportAccess } from "./use-import-access";
import { assertImportUiAccess } from "./import-access";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ImportQueryScope } from "./import-format";
import { JourneyNotice } from "./import-journey-ui";
import { ConnectionLoading, ConnectionError } from "./connection-state";
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Não foi possível configurar esta conexão.";
import {
  getJibbleImportStatus,
  saveJibbleImportConnection,
  confirmJibbleImportSource,
  testJibbleImportConnection,
} from "@/lib/integrations/jibble/jibble.functions";
import { canReadWholeOrg } from "@/lib/integrations/jibble/jibble-map";

export function JibbleSource({
  scope,
  onConfigured,
}: {
  scope: ImportQueryScope;
  onConfigured: () => Promise<void>;
}) {
  const access = useImportAccess(scope);
  const get = useServerFn(getJibbleImportStatus),
    save = useServerFn(saveJibbleImportConnection),
    test = useServerFn(testJibbleImportConnection),
    confirmFn = useServerFn(confirmJibbleImportSource);
  const conn = useQuery({
    queryKey: ["project-import-journey", ...scope, "connection", "jibble"],
    queryFn: () => {
      assertImportUiAccess(access, "jibble", true);
      return get();
    },
    enabled: access.canManage("jibble"),
    retry: false,
  });
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof test>> | null>(null);
  const action = useMutation({
    mutationFn: async () => {
      assertImportUiAccess(access, "jibble", true);
      if (clientId.trim() || clientSecret.trim() || !conn.data?.connection.configured) {
        if (!clientId.trim() || !clientSecret.trim())
          throw new Error(
            "Preencha o Client ID e o Client Secret juntos para substituir a credencial.",
          );
        await save({ data: { clientId: clientId.trim(), clientSecret: clientSecret.trim() } });
        setClientId("");
        setClientSecret("");
        await conn.refetch();
      }
      const next = await test();
      if (!next.ok)
        throw new Error("message" in next ? next.message : "Falha ao testar a conexão.");
      setResult(next);
    },
    onError: (error) => toast.error(message(error)),
  });
  const confirm = useMutation({
    mutationFn: () => {
      assertImportUiAccess(access, "jibble", true);
      return confirmFn({ data: { orgId: result && "org" in result ? result.org!.id : "" } });
    },
    onSuccess: onConfigured,
    onError: (error) => toast.error(message(error)),
  });
  const busy = action.isPending || confirm.isPending;
  if (!access.canManage("jibble"))
    return (
      <p role="alert" className="text-sm">
        Sem permissão para configurar esta origem.
      </p>
    );
  if (conn.isPending) return <ConnectionLoading />;
  if (conn.isError || !conn.data)
    return <ConnectionError scope={scope} provider="jibble" onRetry={() => void conn.refetch()} />;
  if (!conn.data.encryptionReady)
    return (
      <JourneyNotice warning>
        A cifragem da conexão está indisponível. Solicite a regularização ao administrador antes de
        informar credenciais.
      </JourneyNotice>
    );
  const org = result && "org" in result ? result.org : null;
  const sourceAccess = result && "access" in result ? result.access : null;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="journey-jibble-id">Client ID do Jibble</Label>
        <Input
          id="journey-jibble-id"
          type="password"
          autoComplete="new-password"
          value={clientId}
          maxLength={300}
          onChange={(event) => {
            setClientId(event.target.value);
            setResult(null);
          }}
          placeholder={
            conn.data.connection.configured
              ? "Deixe vazio para manter a credencial"
              : "Informe somente neste formulário"
          }
          disabled={busy}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="journey-jibble-secret">Client Secret do Jibble</Label>
        <Input
          id="journey-jibble-secret"
          type="password"
          autoComplete="new-password"
          value={clientSecret}
          maxLength={500}
          onChange={(event) => {
            setClientSecret(event.target.value);
            setResult(null);
          }}
          placeholder="Não compartilhe o segredo fora deste campo"
          disabled={busy}
        />
      </div>
      <Button
        variant={org ? "outline" : "default"}
        disabled={
          busy || (!conn.data.connection.configured && (!clientId.trim() || !clientSecret.trim()))
        }
        onClick={() => action.mutate()}
      >
        {action.isPending && <Loader2 className="animate-spin" aria-hidden />}
        {clientId || clientSecret ? "Salvar e testar conexão" : "Testar conexão"}
      </Button>
      {org && (
        <div className="space-y-3 border-t border-border-subtle pt-4">
          <h3 className="text-sm font-medium">Organização retornada pelo Jibble</h3>
          <p className="text-sm">{org.name ?? "Nome não informado na origem"}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Confirme que esta organização pertence ao workspace atual. Credenciais de proprietário
            ou administrador são obrigatórias.
          </p>
          {!canReadWholeOrg(sourceAccess) && (
            <JourneyNotice warning>
              O papel de proprietário ou administrador não foi comprovado. Use credenciais
              autorizadas antes de continuar.
            </JourneyNotice>
          )}
          <Button
            disabled={busy || !canReadWholeOrg(sourceAccess)}
            onClick={() => confirm.mutate()}
          >
            {confirm.isPending && <Loader2 className="animate-spin" aria-hidden />}Confirmar
            organização
          </Button>
        </div>
      )}
    </div>
  );
}
