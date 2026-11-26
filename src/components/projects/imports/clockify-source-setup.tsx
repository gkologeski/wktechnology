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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ImportQueryScope } from "./import-format";
import { JourneyNotice } from "./import-journey-ui";
import { ConnectionLoading, ConnectionError } from "./connection-state";
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Não foi possível configurar esta conexão.";
import {
  getClockifyImportStatus,
  saveClockifyImportConnection,
  selectClockifyImportSource,
  testClockifyImportConnection,
} from "@/lib/integrations/clockify/clockify.functions";
import { canReadWholeWorkspace } from "@/lib/integrations/clockify/clockify-access";
import { CLOCKIFY_REGIONS, CLOCKIFY_REGION_LABEL } from "@/lib/integrations/clockify/clockify-urls";

export function ClockifySource({
  scope,
  onConfigured,
}: {
  scope: ImportQueryScope;
  onConfigured: () => Promise<void>;
}) {
  const access = useImportAccess(scope);
  const get = useServerFn(getClockifyImportStatus),
    save = useServerFn(saveClockifyImportConnection),
    test = useServerFn(testClockifyImportConnection),
    select = useServerFn(selectClockifyImportSource);
  const conn = useQuery({
    queryKey: ["project-import-journey", ...scope, "connection", "clockify"],
    queryFn: () => {
      assertImportUiAccess(access, "clockify", true);
      return get();
    },
    enabled: access.canManage("clockify"),
    retry: false,
  });
  const [key, setKey] = useState("");
  const [region, setRegion] = useState<string | null>(null);
  const [subdomain, setSubdomain] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Awaited<ReturnType<typeof test>>["workspaces"]>([]);
  const [sourceId, setSourceId] = useState("");
  const [tested, setTested] = useState(false);
  const effectiveRegion = region ?? conn.data?.connection.region ?? "global";
  const effectiveSubdomain = subdomain ?? conn.data?.connection.subdomain ?? "";
  const action = useMutation({
    mutationFn: async () => {
      assertImportUiAccess(access, "clockify", true);
      if (
        key.trim() ||
        region !== null ||
        subdomain !== null ||
        !conn.data?.connection.configured
      ) {
        await save({
          data: {
            apiKey: key.trim() || undefined,
            region: effectiveRegion,
            subdomain: effectiveSubdomain.trim() || null,
          },
        });
        setKey("");
        await conn.refetch();
      }
      const result = await test();
      if (!result.ok) throw new Error(result.message ?? "Falha ao testar a conexão.");
      setWorkspaces(result.workspaces);
      setSourceId("");
      setTested(true);
    },
    onError: (error) => toast.error(message(error)),
  });
  const confirm = useMutation({
    mutationFn: () => {
      assertImportUiAccess(access, "clockify", true);
      return select({ data: { sourceWorkspaceId: sourceId } });
    },
    onSuccess: onConfigured,
    onError: (error) => toast.error(message(error)),
  });
  const busy = action.isPending || confirm.isPending;
  if (!access.canManage("clockify"))
    return (
      <p role="alert" className="text-sm">
        Sem permissão para configurar esta origem.
      </p>
    );
  if (conn.isPending) return <ConnectionLoading />;
  if (conn.isError || !conn.data)
    return (
      <ConnectionError scope={scope} provider="clockify" onRetry={() => void conn.refetch()} />
    );
  if (!conn.data.encryptionReady)
    return (
      <JourneyNotice warning>
        A cifragem da conexão está indisponível. Solicite a regularização ao administrador antes de
        informar credenciais.
      </JourneyNotice>
    );
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="journey-clockify-key">Chave de API do Clockify</Label>
        <Input
          id="journey-clockify-key"
          type="password"
          autoComplete="new-password"
          spellCheck={false}
          value={key}
          maxLength={300}
          onChange={(event) => {
            setKey(event.target.value);
            setTested(false);
          }}
          placeholder={
            conn.data.connection.configured
              ? "Deixe vazio para manter a chave salva"
              : "Informe a chave somente neste campo"
          }
          disabled={busy}
        />
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer py-1 text-muted-foreground">Região e subdomínio</summary>
        <div className="mt-3 space-y-3">
          <Label htmlFor="journey-clockify-region">Região</Label>
          <Select
            value={effectiveRegion}
            onValueChange={(value) => {
              setRegion(value);
              setTested(false);
            }}
            disabled={busy}
          >
            <SelectTrigger id="journey-clockify-region">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLOCKIFY_REGIONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {CLOCKIFY_REGION_LABEL[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label htmlFor="journey-clockify-subdomain">
            Subdomínio do workspace (quando houver)
          </Label>
          <Input
            id="journey-clockify-subdomain"
            value={effectiveSubdomain}
            onChange={(event) => {
              setSubdomain(event.target.value);
              setTested(false);
            }}
            disabled={busy}
            placeholder="Opcional"
          />
        </div>
      </details>
      <Button
        variant={tested ? "outline" : "default"}
        disabled={busy || (!conn.data.connection.configured && !key.trim())}
        onClick={() => action.mutate()}
      >
        {action.isPending && <Loader2 className="animate-spin" aria-hidden />}
        {key.trim() ? "Salvar e testar conexão" : "Testar conexão"}
      </Button>
      {tested && (
        <div className="space-y-3 border-t border-border-subtle pt-4">
          <Label htmlFor="journey-clockify-source">Organização do Clockify</Label>
          <Select value={sourceId} onValueChange={setSourceId} disabled={busy}>
            <SelectTrigger id="journey-clockify-source">
              <SelectValue placeholder="Escolha a organização autorizada" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((workspace) => (
                <SelectItem
                  key={workspace.id}
                  value={workspace.id}
                  disabled={!canReadWholeWorkspace(workspace.access)}
                >
                  {workspace.name}
                  {!canReadWholeWorkspace(workspace.access)
                    ? " · acesso administrativo não comprovado"
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs leading-relaxed text-muted-foreground">
            A chave deve comprovar papel de proprietário ou administrador na organização escolhida.
          </p>
          <Button disabled={!sourceId || busy} onClick={() => confirm.mutate()}>
            {confirm.isPending && <Loader2 className="animate-spin" aria-hidden />}Confirmar
            organização
          </Button>
        </div>
      )}
    </div>
  );
}
