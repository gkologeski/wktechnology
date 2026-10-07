// Persona, teste em sandbox e versões (rascunho × publicado) do agente.
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RotateCcw, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState, FormSection, SectionHeader } from "@/components/techhire/ui";
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
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <SectionHeader
          title="Persona e tom"
          description="Vale para prospecção e receptivo. Salvar e testar não alteram a versão publicada."
        />
        <FormSection title="Identidade">
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pa-name">Nome do assistente</Label>
              <Input
                id="pa-name"
                value={persona.assistant_name}
                onChange={(e) => set("assistant_name", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pa-desc">Descrição</Label>
              <Textarea
                id="pa-desc"
                rows={2}
                value={persona.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pa-tone">Tom</Label>
              <select
                id="pa-tone"
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={persona.tone}
                onChange={(e) => set("tone", e.target.value as Persona["tone"])}
              >
                <option value="acolhedor">Acolhedor</option>
                <option value="objetivo">Objetivo</option>
                <option value="consultivo">Consultivo</option>
              </select>
            </div>
            {(
              [
                ["formality", "Formalidade (1 informal – 5 formal)"],
                ["warmth", "Calor (1 neutro – 5 caloroso)"],
                ["concision", "Concisão (1 detalhado – 5 curto)"],
              ] as const
            ).map(([k, label]) => (
              <div key={k} className="grid gap-1.5">
                <Label htmlFor={`pa-${k}`}>
                  {label}: {persona[k]}
                </Label>
                <input
                  id={`pa-${k}`}
                  type="range"
                  min={1}
                  max={5}
                  value={persona[k]}
                  onChange={(e) => set(k, Number(e.target.value))}
                  className="accent-primary"
                />
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={persona.emojis === "discreet"}
                onChange={(e) => set("emojis", e.target.checked ? "discreet" : "none")}
              />
              Permitir emoji discreto
            </label>
          </div>
        </FormSection>
        <FormSection title="Atendimento">
          <div className="grid gap-3">
            {(
              [
                ["goal", "Objetivo do atendimento"],
                ["collect", "Informações a coletar"],
                ["handoff_when", "Quando chamar uma pessoa"],
                ["instructions", "Instruções adicionais"],
              ] as const
            ).map(([k, label]) => (
              <div key={k} className="grid gap-1.5">
                <Label htmlFor={`pa-${k}`}>{label}</Label>
                <Textarea
                  id={`pa-${k}`}
                  rows={2}
                  value={persona[k]}
                  onChange={(e) => set(k, e.target.value)}
                />
              </div>
            ))}
            <div className="grid gap-1.5">
              <Label htmlFor="pa-good">Exemplos do jeito certo (um por linha)</Label>
              <Textarea
                id="pa-good"
                rows={3}
                value={persona.good_examples.join("\n")}
                onChange={(e) =>
                  set(
                    "good_examples",
                    e.target.value
                      .split("\n")
                      .filter((l) => l.trim())
                      .slice(0, 10),
                  )
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pa-avoid">Expressões a evitar (separadas por vírgula)</Label>
              <Input
                id="pa-avoid"
                value={persona.avoid_phrases.join(", ")}
                onChange={(e) =>
                  set(
                    "avoid_phrases",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .slice(0, 30),
                  )
                }
              />
            </div>
          </div>
        </FormSection>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
            {saveM.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Salvar rascunho
          </Button>
          <Button
            variant="outline"
            disabled={!draft || pubM.isPending}
            onClick={() => draft && pubM.mutate(draft.id)}
          >
            <Upload className="mr-1 h-4 w-4" />
            Publicar rascunho
          </Button>
        </div>
        <FormSection title="Versões">
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground" role="status">
              Carregando…
            </p>
          ) : q.error ? (
            <p className="text-sm text-destructive">{(q.error as Error).message}</p>
          ) : !q.data?.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma versão ainda. Enquanto nada for publicado, o agente usa o estilo padrão.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {q.data.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    v{v.version}{" "}
                    <Badge variant={v.status === "published" ? "default" : "outline"}>
                      {STATUS[v.status]}
                    </Badge>
                  </span>
                  {v.status === "archived" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pubM.isPending}
                      onClick={() => pubM.mutate(v.id)}
                    >
                      <RotateCcw className="mr-1 h-3.5 w-3.5" />
                      Restaurar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {published && (
            <p className="mt-2 text-xs text-muted-foreground">Em produção: v{published.version}</p>
          )}
        </FormSection>
      </div>
      <TestChat workspaceId={workspaceId} playbookId={playbookId} persona={persona} />
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
    <div className="flex flex-col gap-3">
      <SectionHeader
        title="Testar"
        description="Usa o rascunho atual na tela. Sem WhatsApp, CRM, agenda ou notificações; não entra nas métricas."
      />
      <div className="flex items-center gap-2 text-sm">
        <Label htmlFor="pa-origin">Origem simulada</Label>
        <select
          id="pa-origin"
          className="h-8 rounded-md border border-input bg-background px-2"
          value={origin}
          onChange={(e) => setOrigin(e.target.value as typeof origin)}
        >
          <option value="inbound">Receptivo</option>
          <option value="prospecting">Prospecção</option>
        </select>
        <Button size="sm" variant="ghost" onClick={() => setMsgs([])} disabled={!msgs.length}>
          Limpar
        </Button>
      </div>
      <div
        className="min-h-[320px] flex-1 space-y-3 rounded-md border border-border bg-muted/30 p-3"
        aria-live="polite"
      >
        {!msgs.length && (
          <p className="text-sm text-muted-foreground">Escreva como se fosse o cliente.</p>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "max-w-[90%] text-sm"
              }
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.trace && (
                <details className="mt-1 text-xs text-muted-foreground">
                  <summary>Trace do turno</summary>
                  <pre className="overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(m.trace, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <p className="text-sm text-muted-foreground" role="status">
            <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
            Respondendo…
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Textarea
          ref={ref}
          autoFocus
          rows={2}
          aria-label="Mensagem de teste"
          placeholder="Enter envia, Shift+Enter quebra linha"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button
          onClick={() => void send()}
          disabled={busy || !text.trim()}
          aria-label="Enviar mensagem de teste"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Anexos (imagem, áudio, vídeo, documentos) ainda não são suportados no teste.
      </p>
    </div>
  );
}
