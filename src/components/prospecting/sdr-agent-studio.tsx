// Persona, teste em sandbox e versões (rascunho × publicado) do agente.
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  Check,
  History,
  Loader2,
  MessageSquareText,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, FormSection, ProductPanel } from "@/components/techhire/ui";
import {
  getSdrAgentVersions,
  publishSdrAgentVersion,
  saveSdrAgentDraft,
  testSdrAgent,
} from "@/lib/prospecting/sdr-agent.functions";
import { DEFAULT_PERSONA, parsePersona, type Persona } from "@/lib/prospecting/sdr/persona";

type Msg = { role: "user" | "assistant"; text: string; trace?: Record<string, unknown> };

const STATUS: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicada",
  archived: "Arquivada",
};

const TRAIT_LABELS = {
  formality: { label: "Formalidade", low: "Informal", high: "Formal" },
  warmth: { label: "Calor", low: "Neutro", high: "Caloroso" },
  concision: { label: "Concisão", low: "Detalhado", high: "Direto" },
} as const;

export function SdrAgentStudio({
  workspaceId,
  playbookId,
}: {
  workspaceId: string;
  playbookId: string | null;
}) {
  if (!playbookId)
    return <EmptyState title="Sem agente" description="Crie o playbook do piloto primeiro." />;
  return <Studio workspaceId={workspaceId} playbookId={playbookId} />;
}

function Studio({ workspaceId, playbookId }: { workspaceId: string; playbookId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(getSdrAgentVersions);
  const save = useServerFn(saveSdrAgentDraft);
  const publish = useServerFn(publishSdrAgentVersion);
  const key = ["sdr-agent-versions", playbookId];
  const q = useQuery({ queryKey: key, queryFn: () => list({ data: { workspaceId, playbookId } }) });
  const [persona, setPersona] = useState<Persona>(DEFAULT_PERSONA);
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current || !q.data) return;
    const src =
      q.data.find((v) => v.status === "draft") ?? q.data.find((v) => v.status === "published");
    if (src) setPersona(parsePersona(src.persona));
    loaded.current = true;
  }, [q.data]);
  const set = <K extends keyof Persona>(k: K, v: Persona[K]) =>
    setPersona((p) => ({ ...p, [k]: v }));

  const saveM = useMutation({
    mutationFn: () => save({ data: { workspaceId, playbookId, persona } }),
    onSuccess: () => (
      toast.success("Rascunho salvo (a versão publicada não mudou)"),
      qc.invalidateQueries({ queryKey: key })
    ),
    onError: (e: Error) => toast.error(e.message),
  });
  const pubM = useMutation({
    mutationFn: (versionId: string) => publish({ data: { workspaceId, playbookId, versionId } }),
    onSuccess: () => (
      toast.success("Versão publicada para o agente"),
      qc.invalidateQueries({ queryKey: key })
    ),
    onError: (e: Error) => toast.error(e.message),
  });

  const draft = q.data?.find((v) => v.status === "draft");
  const published = q.data?.find((v) => v.status === "published");

  return (
    <div className="space-y-4">
      <ProductPanel className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-product-divider bg-product-toolbar px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
              <Bot className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-text-primary">Persona e teste</h2>
                <Badge variant="outline">Rascunho</Badge>
                {published ? (
                  <Badge variant="secondary">Produção v{published.version}</Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-text-secondary">
                Ajuste a voz do agente e valide a conversa em ambiente seguro antes de publicar.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => saveM.mutate()} disabled={saveM.isPending}>
              {saveM.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar rascunho
            </Button>
            <Button
              disabled={!draft || pubM.isPending}
              onClick={() => draft && pubM.mutate(draft.id)}
            >
              {pubM.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Publicar rascunho
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-xs text-text-secondary md:px-5">
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-3.5 text-success" aria-hidden="true" />
            Testar não altera a produção
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            Mesmo estilo para receptivo e prospecção
          </span>
        </div>
      </ProductPanel>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)] xl:items-start">
        <div className="min-w-0 space-y-4">
          <ProductPanel className="px-4 md:px-5">
            <FormSection
              title="Identidade e voz"
              description="Defina como o agente se apresenta e conduz cada conversa."
              className="md:grid-cols-[180px_minmax(0,1fr)]"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="pa-name">Nome do assistente</Label>
                  <Input
                    id="pa-name"
                    value={persona.assistant_name}
                    onChange={(e) => set("assistant_name", e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="pa-desc">Descrição</Label>
                  <Textarea
                    id="pa-desc"
                    rows={2}
                    value={persona.description}
                    onChange={(e) => set("description", e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="pa-tone">Tom principal</Label>
                  <Select
                    value={persona.tone}
                    onValueChange={(value) => set("tone", value as Persona["tone"])}
                  >
                    <SelectTrigger id="pa-tone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="acolhedor">Acolhedor</SelectItem>
                      <SelectItem value="objetivo">Objetivo</SelectItem>
                      <SelectItem value="consultivo">Consultivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(Object.keys(TRAIT_LABELS) as Array<keyof typeof TRAIT_LABELS>).map((key) => {
                  const trait = TRAIT_LABELS[key];
                  return (
                    <div
                      key={key}
                      className="grid gap-3 rounded-md border border-border-subtle bg-surface-sunken p-3 sm:col-span-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor={`pa-${key}`}>{trait.label}</Label>
                        <span className="min-w-6 rounded-md bg-product-panel px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums text-text-primary">
                          {persona[key]}
                        </span>
                      </div>
                      <Slider
                        id={`pa-${key}`}
                        min={1}
                        max={5}
                        step={1}
                        value={[persona[key]]}
                        onValueChange={([value]) => {
                          if (value !== undefined) set(key, value);
                        }}
                        aria-label={trait.label}
                      />
                      <div className="flex justify-between text-[11px] text-text-tertiary">
                        <span>{trait.low}</span>
                        <span>{trait.high}</span>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between gap-4 rounded-md border border-border-subtle px-3 py-3 sm:col-span-2">
                  <div>
                    <Label htmlFor="pa-emojis">Emoji discreto</Label>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      Permite uso pontual quando combinar com a conversa.
                    </p>
                  </div>
                  <Switch
                    id="pa-emojis"
                    checked={persona.emojis === "discreet"}
                    onCheckedChange={(checked) => set("emojis", checked ? "discreet" : "none")}
                  />
                </div>
              </div>
            </FormSection>
          </ProductPanel>

          <ProductPanel className="px-4 md:px-5">
            <FormSection
              title="Condução do atendimento"
              description="Oriente objetivos, coleta de contexto e passagem para uma pessoa."
              className="md:grid-cols-[180px_minmax(0,1fr)]"
            >
              <div className="grid gap-4">
                {(
                  [
                    ["goal", "Objetivo do atendimento"],
                    ["collect", "Informações a coletar"],
                    ["handoff_when", "Quando chamar uma pessoa"],
                    ["instructions", "Instruções adicionais"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="grid gap-1.5">
                    <Label htmlFor={`pa-${key}`}>{label}</Label>
                    <Textarea
                      id={`pa-${key}`}
                      rows={3}
                      value={persona[key]}
                      onChange={(e) => set(key, e.target.value)}
                    />
                  </div>
                ))}
                <div className="grid gap-1.5">
                  <Label htmlFor="pa-good">Exemplos do jeito certo</Label>
                  <Textarea
                    id="pa-good"
                    rows={4}
                    placeholder="Um exemplo por linha"
                    value={persona.good_examples.join("\n")}
                    onChange={(e) =>
                      set(
                        "good_examples",
                        e.target.value
                          .split("\n")
                          .filter((line) => line.trim())
                          .slice(0, 10),
                      )
                    }
                  />
                  <p className="text-xs text-text-tertiary">
                    Um exemplo por linha, até 10 exemplos.
                  </p>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pa-avoid">Expressões a evitar</Label>
                  <Input
                    id="pa-avoid"
                    placeholder="Separe as expressões por vírgula"
                    value={persona.avoid_phrases.join(", ")}
                    onChange={(e) =>
                      set(
                        "avoid_phrases",
                        e.target.value
                          .split(",")
                          .map((value) => value.trim())
                          .filter(Boolean)
                          .slice(0, 30),
                      )
                    }
                  />
                </div>
              </div>
            </FormSection>
          </ProductPanel>

          <ProductPanel className="overflow-hidden">
            <div className="flex items-start gap-3 border-b border-product-divider px-4 py-4 md:px-5">
              <History className="mt-0.5 size-4 text-text-tertiary" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Histórico de versões</h3>
                <p className="mt-0.5 text-xs text-text-secondary">
                  Publicar promove o rascunho atual. Versões anteriores podem ser restauradas.
                </p>
              </div>
            </div>
            <div className="px-4 py-2 md:px-5">
              {q.isLoading ? (
                <div
                  className="flex items-center gap-2 py-6 text-sm text-text-secondary"
                  role="status"
                >
                  <Loader2 className="size-4 animate-spin" /> Carregando versões…
                </div>
              ) : q.error ? (
                <div className="flex flex-col items-start gap-2 py-4">
                  <p className="text-sm text-destructive">{(q.error as Error).message}</p>
                  <Button size="sm" variant="outline" onClick={() => q.refetch()}>
                    Tentar novamente
                  </Button>
                </div>
              ) : !q.data?.length ? (
                <p className="py-5 text-sm text-text-secondary">
                  Nenhuma versão ainda. Até a primeira publicação, o agente usa o estilo padrão.
                </p>
              ) : (
                <ul className="divide-y divide-product-divider">
                  {q.data.map((version) => (
                    <li
                      key={version.id}
                      className="flex min-h-12 items-center justify-between gap-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2 text-sm">
                        <span className="font-medium tabular-nums text-text-primary">
                          v{version.version}
                        </span>
                        <Badge variant={version.status === "published" ? "default" : "outline"}>
                          {STATUS[version.status]}
                        </Badge>
                      </div>
                      {version.status === "archived" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pubM.isPending}
                          onClick={() => pubM.mutate(version.id)}
                        >
                          <RotateCcw className="size-3.5" />
                          Restaurar
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </ProductPanel>
        </div>

        <TestChat workspaceId={workspaceId} playbookId={playbookId} persona={persona} />
      </div>
    </div>
  );
}

function TestChat({
  workspaceId,
  playbookId,
  persona,
}: {
  workspaceId: string;
  playbookId: string;
  persona: Persona;
}) {
  const run = useServerFn(testSdrAgent);
  const [origin, setOrigin] = useState<"inbound" | "prospecting">("inbound");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  async function send() {
    const t = text.trim();
    if (!t || busy) return;
    const next = [...msgs, { role: "user" as const, text: t }];
    setMsgs(next);
    setText("");
    setBusy(true);
    try {
      const r = await run({
        data: {
          workspaceId,
          playbookId,
          persona,
          origin,
          messages: next.map(({ role, text }) => ({ role, text })),
        },
      });
      if (r.ok)
        setMsgs((m) => [
          ...m,
          { role: "assistant", text: r.reply || "(sem texto)", trace: { ...r.trace, ms: r.ms } },
        ]);
      else toast.error(`Falha no teste: ${r.error}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      ref.current?.focus();
    }
  }

  return (
    <ProductPanel className="flex min-h-[640px] min-w-0 flex-col overflow-hidden xl:sticky xl:top-4 xl:h-[calc(100dvh-8rem)] xl:min-h-[560px] xl:max-h-[820px]">
      <div className="border-b border-product-divider bg-product-toolbar px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-product-panel text-text-secondary">
              <MessageSquareText className="size-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Conversa de teste</h3>
              <p className="mt-0.5 text-xs text-text-secondary">
                Usa o rascunho aberto nesta tela.
              </p>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setMsgs([])}
            disabled={!msgs.length}
            aria-label="Limpar conversa de teste"
            title="Limpar conversa"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
        <div className="mt-3 grid gap-1.5">
          <Label htmlFor="pa-origin" className="text-xs">
            Origem simulada
          </Label>
          <Select value={origin} onValueChange={(value) => setOrigin(value as typeof origin)}>
            <SelectTrigger id="pa-origin">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inbound">Receptivo</SelectItem>
              <SelectItem value="prospecting">Prospecção</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div
        className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-surface-sunken p-4"
        aria-live="polite"
      >
        {!msgs.length && (
          <div className="flex h-full min-h-56 flex-col items-center justify-center px-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-md border border-border-subtle bg-product-panel text-text-tertiary">
              <Bot className="size-5" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-medium text-text-primary">Comece uma conversa</p>
            <p className="mt-1 max-w-xs text-xs text-text-secondary">
              Escreva como se fosse o cliente. Nenhuma mensagem ou ação será enviada para fora deste
              teste.
            </p>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-md bg-primary px-3 py-2.5 text-sm text-primary-foreground shadow-xs"
                  : "max-w-[92%] rounded-md border border-border-subtle bg-product-panel px-3 py-2.5 text-sm text-text-primary shadow-xs"
              }
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.trace && (
                <details className="mt-2 border-t border-border-subtle pt-2 text-xs text-text-tertiary">
                  <summary className="cursor-pointer select-none">Trace do turno</summary>
                  <pre className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap rounded-md bg-surface-sunken p-2">
                    {JSON.stringify(m.trace, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <p className="flex items-center gap-2 text-sm text-text-secondary" role="status">
            <Loader2 className="size-3.5 animate-spin" />
            Respondendo…
          </p>
        )}
      </div>
      <div className="border-t border-product-divider bg-product-panel p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={ref}
            rows={2}
            aria-label="Mensagem de teste"
            placeholder="Escreva uma mensagem…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            className="min-h-16 resize-none"
          />
          <Button
            size="icon"
            onClick={() => void send()}
            disabled={busy || !text.trim()}
            aria-label="Enviar mensagem de teste"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[11px] text-text-tertiary">
          <span>Enter envia · Shift+Enter quebra linha</span>
          <span>Sem WhatsApp, CRM, agenda ou métricas</span>
        </div>
        <p className="mt-2 text-[11px] text-text-tertiary">
          Anexos de imagem, áudio, vídeo e documentos ainda não são suportados.
        </p>
      </div>
    </ProductPanel>
  );
}
