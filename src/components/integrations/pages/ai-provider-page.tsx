import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { PageHeader, FormSection, Skeletons, EmptyState } from "@/components/techhire/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getAiSettings,
  removeAiCredential,
  saveAiProvider,
  setActiveAiProvider,
  testAiProvider,
} from "@/lib/ai/ai-settings.functions";
import { AI_PROVIDERS, type AiProviderDef, type AiProviderId } from "@/lib/ai/providers";

type Settings = Awaited<ReturnType<typeof getAiSettings>>;

const STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  not_configured: { label: "Não configurado", variant: "outline" },
  configured: { label: "Configurado", variant: "secondary" },
  connected: { label: "Conectado", variant: "default" },
  failed: { label: "Falha", variant: "destructive" },
  disabled: { label: "Desativado", variant: "outline" },
};

export function AiProviderPage() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getAiSettings);
  const q = useQuery({ queryKey: ["ai-settings"], queryFn: () => fetchSettings() });
  const activate = useServerFn(setActiveAiProvider);
  const [confirm, setConfirm] = useState<AiProviderId | null>(null);

  const activateMut = useMutation({
    mutationFn: (provider: AiProviderId) => activate({ data: { provider } }),
    onSuccess: () => {
      toast.success("Provedor de IA atualizado.");
      qc.invalidateQueries({ queryKey: ["ai-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Integrações"
        title="Inteligência Artificial"
        description="Escolha qual IA atende os recursos do workspace. A Lovable AI é o padrão e não exige chave."
        primaryAction={
          q.data && q.data.isAdmin && q.data.active.provider !== "lovable" ? (
            <Button variant="outline" onClick={() => setConfirm("lovable")}>
              Voltar para Lovable AI
            </Button>
          ) : null
        }
      />

      {q.isLoading && <Skeletons.Card />}
      {q.isError && (
        <EmptyState
          title="Não foi possível carregar a configuração de IA"
          description={(q.error as Error).message}
          action={<Button onClick={() => q.refetch()}>Tentar novamente</Button>}
        />
      )}
      {q.data && (
        <div className="rounded-lg border border-border-subtle bg-card px-4 md:px-6">
          {AI_PROVIDERS.map((p) => (
            <ProviderRow
              key={p.id}
              def={p}
              settings={q.data}
              onActivate={() => setConfirm(p.id)}
              activating={activateMut.isPending && activateMut.variables === p.id}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trocar o provedor de IA?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os recursos de IA do workspace passarão a usar{" "}
              {AI_PROVIDERS.find((p) => p.id === confirm)?.name}. Com chave própria, o consumo é
              cobrado pelo provedor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm) activateMut.mutate(confirm);
                setConfirm(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProviderRow({
  def,
  settings,
  onActivate,
  activating,
}: {
  def: AiProviderDef;
  settings: Settings;
  onActivate: () => void;
  activating: boolean;
}) {
  const qc = useQueryClient();
  const cred = settings.credentials.find((c) => c.provider === def.id);
  const isActive = settings.active.provider === def.id;
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(cred?.model ?? def.defaultModel);
  const save = useServerFn(saveAiProvider);
  const test = useServerFn(testAiProvider);
  const remove = useServerFn(removeAiCredential);
  const refresh = () => qc.invalidateQueries({ queryKey: ["ai-settings"] });

  const saveMut = useMutation({
    mutationFn: () =>
      save({
        data: {
          provider: def.id as Exclude<AiProviderId, "lovable">,
          apiKey: apiKey || undefined,
          model,
        },
      }),
    onSuccess: () => {
      setApiKey("");
      toast.success("Configuração salva.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const testMut = useMutation({
    mutationFn: () => test({ data: { provider: def.id } }),
    onSuccess: (r) => {
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeMut = useMutation({
    mutationFn: () => remove({ data: { provider: def.id as Exclude<AiProviderId, "lovable"> } }),
    onSuccess: () => {
      toast.success("Chave removida.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusKey = isActive
    ? settings.active.status
    : def.requiresKey
      ? cred
        ? "configured"
        : "not_configured"
      : "configured";
  const st = STATUS[statusKey] ?? STATUS.configured;
  const readOnly = !settings.isAdmin;
  const listId = `models-${def.id}`;

  return (
    <FormSection title={def.name} description={def.description}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {isActive && (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Em uso
            </Badge>
          )}
          <Badge variant={st.variant}>{testMut.isPending ? "Testando…" : st.label}</Badge>
          {def.id === "lovable" && (
            <Badge variant="outline" className="gap-1">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Padrão
            </Badge>
          )}
        </div>
        {isActive && settings.active.lastError && (
          <p role="alert" className="text-sm text-destructive">
            {settings.active.lastError}
          </p>
        )}

        {def.requiresKey && (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`key-${def.id}`}>Chave de API</Label>
              <Input
                id={`key-${def.id}`}
                type="password"
                autoComplete="off"
                disabled={readOnly}
                placeholder={cred ? `•••• ${cred.keyLast4 ?? ""}` : def.keyHint}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              {def.keyDocsUrl && (
                <a
                  href={def.keyDocsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Onde obter a chave <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`model-${def.id}`}>Modelo</Label>
              <Input
                id={`model-${def.id}`}
                list={listId}
                disabled={readOnly}
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
              <datalist id={listId}>
                {def.suggestedModels.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
          </div>
        )}

        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            {def.requiresKey && (
              <Button
                size="sm"
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || !model || (!cred && !apiKey)}
              >
                {saveMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />}
                Salvar
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => testMut.mutate()}
              disabled={testMut.isPending || (def.requiresKey && !cred)}
            >
              {testMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />}
              Testar conexão
            </Button>
            {!isActive && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onActivate}
                disabled={activating || (def.requiresKey && !cred)}
              >
                Usar como padrão
              </Button>
            )}
            {def.requiresKey && cred && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeMut.mutate()}
                disabled={removeMut.isPending}
              >
                Remover chave
              </Button>
            )}
          </div>
        )}
      </div>
    </FormSection>
  );
}
