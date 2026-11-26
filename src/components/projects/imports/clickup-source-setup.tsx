import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getClickUpImportConnectionState,
  saveClickUpImportConnection,
  getClickUpImportSources,
  saveClickUpImportSources,
} from "@/lib/integrations/clickup/clickup-import.functions";
import { useImportAccess } from "./use-import-access";
import { assertImportUiAccess } from "./import-access";
import type { ImportQueryScope } from "./import-format";
import { JourneyNotice } from "./import-journey-ui";
import { ConnectionLoading, ConnectionError } from "./connection-state";
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Não foi possível configurar esta conexão.";

export function ClickUpSource({
  scope,
  onConfigured,
}: {
  scope: ImportQueryScope;
  onConfigured: () => Promise<void>;
}) {
  const access = useImportAccess(scope),
    client = useQueryClient();
  const getState = useServerFn(getClickUpImportConnectionState),
    saveKey = useServerFn(saveClickUpImportConnection),
    getSources = useServerFn(getClickUpImportSources),
    saveSources = useServerFn(saveClickUpImportSources);
  const [key, setKey] = useState("");
  const [ids, setIds] = useState<string[] | null>(null);
  const connKey = ["project-import-journey", ...scope, "connection", "clickup", "state"];
  const conn = useQuery({
    queryKey: connKey,
    queryFn: () => {
      assertImportUiAccess(access, "clickup", true);
      return getState();
    },
    enabled: access.canManage("clickup"),
    retry: false,
  });
  const sources = useQuery({
    queryKey: ["project-import-journey", ...scope, "connection", "clickup", "sources"],
    queryFn: () => {
      assertImportUiAccess(access, "clickup", true);
      return getSources();
    },
    enabled: access.canManage("clickup") && !!conn.data?.configured,
    retry: false,
  });
  const selected = ids ?? sources.data?.selectedIds ?? [];
  const credentials = useMutation({
    mutationFn: () => {
      assertImportUiAccess(access, "clickup", true);
      return saveKey({ data: { apiKey: key.trim() } });
    },
    onSuccess: async () => {
      setKey("");
      setIds(null);
      await client.invalidateQueries({ queryKey: connKey });
      await sources.refetch();
      await client.invalidateQueries({ queryKey: ["project-import-journey", ...scope, "status"] });
      toast.success(
        "Chave cifrada e testada. Confirme as organizações autorizadas antes de importar.",
      );
    },
    onError: (error) => toast.error(message(error)),
  });
  const action = useMutation({
    mutationFn: () => {
      assertImportUiAccess(access, "clickup", true);
      return saveSources({ data: { sourceTeamIds: selected } });
    },
    onSuccess: onConfigured,
    onError: (error) => toast.error(message(error)),
  });
  const busy = credentials.isPending || action.isPending;
  if (!access.canManage("clickup"))
    return (
      <p role="alert" className="text-sm">
        Sem permissão para configurar esta origem.
      </p>
    );
  if (conn.isPending) return <ConnectionLoading />;
  if (conn.isError || !conn.data)
    return <ConnectionError scope={scope} provider="clickup" onRetry={() => void conn.refetch()} />;
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="journey-clickup-key">Chave de API do ClickUp</Label>
        <Input
          id="journey-clickup-key"
          type="password"
          autoComplete="new-password"
          spellCheck={false}
          maxLength={500}
          value={key}
          onChange={(event) => setKey(event.target.value)}
          disabled={busy || !conn.data.encryptionReady}
          placeholder={
            conn.data.configured
              ? "Deixe vazio para manter a chave deste workspace"
              : "Informe a chave somente neste campo"
          }
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          A chave é vinculada ao workspace ativo. Credenciais de outras empresas não são
          reutilizadas automaticamente.
        </p>
      </div>
      {!conn.data.encryptionReady && (
        <JourneyNotice warning>
          A cifragem está indisponível. A chave não pode ser cadastrada ou substituída até a
          configuração do servidor ser regularizada.
        </JourneyNotice>
      )}
      <Button
        variant={key.trim() || !conn.data.configured ? "default" : "outline"}
        disabled={busy || key.trim().length < 20 || !conn.data.encryptionReady}
        onClick={() => credentials.mutate()}
      >
        {credentials.isPending && <Loader2 className="animate-spin" aria-hidden />}Salvar e testar
        chave
      </Button>
      {conn.data.configured && (
        <section className="space-y-4 border-t border-border-subtle pt-4">
          <h3 className="text-sm font-medium">Organizações autorizadas do ClickUp</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            A credencial pode enxergar mais de uma empresa. Selecione explicitamente somente as
            organizações que pertencem a este workspace.
          </p>
          {sources.isPending ? (
            <ConnectionLoading />
          ) : sources.isError || !sources.data ? (
            <ConnectionError
              scope={scope}
              provider="clickup"
              onRetry={() => void sources.refetch()}
            />
          ) : (
            <>
              <div className="divide-y divide-border-subtle">
                {sources.data.available.map((source) => (
                  <label
                    key={source.id}
                    className="flex cursor-pointer items-center gap-3 py-3 text-sm"
                  >
                    <Checkbox
                      checked={selected.includes(source.id)}
                      disabled={busy || !!key.trim()}
                      onCheckedChange={(checked) =>
                        setIds(
                          checked === true
                            ? [...new Set([...selected, source.id])]
                            : selected.filter((id) => id !== source.id),
                        )
                      }
                    />
                    {source.name}
                  </label>
                ))}
              </div>
              {sources.data.available.length === 0 && (
                <JourneyNotice warning>
                  Nenhuma organização foi disponibilizada pela conexão. Confira a credencial e o
                  acesso na origem antes de importar.
                </JourneyNotice>
              )}
              <Button
                disabled={busy || selected.length === 0 || !!key.trim()}
                onClick={() => action.mutate()}
              >
                {action.isPending && <Loader2 className="animate-spin" aria-hidden />}Confirmar
                organizações
              </Button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
