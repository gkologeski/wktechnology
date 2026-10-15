// Configuração completa e independente de UM agente SDR: catálogo, materiais,
// ferramentas, qualificação/CRM, responsável e agenda, handoff, canais,
// guardrails, fontes e logs. Nada aqui é global — vale só para o agente aberto.
import { useSdrPlaybooks } from "@/hooks/use-default-sdr-agent";
import {
  agentOptionLabel,
  pickDefaultAgent,
  sortDefaultFirst,
} from "@/lib/prospecting/sdr/default-agent";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, FormSection, ProductPanel } from "@/components/techhire/ui";
import {
  getSdrAgentConfig,
  getSdrAgentLogs,
  saveSdrAgentConfig,
} from "@/lib/prospecting/sdr-agent.functions";
import { SDR_TOOLS, type AgentConfig, type SdrTool } from "@/lib/prospecting/sdr/agent-config";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";

const TOOL_LABEL: Record<SdrTool, string> = {
  qualify: "Qualificar e gravar no CRM",
  material: "Enviar materiais aprovados",
  schedule: "Oferecer agenda",
  handoff: "Passar para uma pessoa",
};

// Áreas de texto mais altas e com alça de arrastar na borda inferior
// (teto de ~16 linhas para nenhuma caixa sair do controle da tela).
const TEXTAREA_CLASS = "resize-y max-h-[21rem]";

const NONE = "__none__";

export function SdrAgentConfigPanel({
  workspaceId,
  playbooks,
}: {
  workspaceId: string;
  playbooks: { id: string; name: string; enabled: boolean }[];
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const { defaultPlaybookId } = useSdrPlaybooks();
  const playbookId =
    picked && playbooks.some((p) => p.id === picked)
      ? picked
      : pickDefaultAgent(playbooks, defaultPlaybookId);

  if (!playbooks.length)
    return (
      <EmptyState
        title="Nenhum agente ainda"
        description="Crie um agente na aba Playbook para configurar persona, catálogo e ferramentas."
      />
    );

  return (
    <div className="space-y-4">
      <div className="flex w-full max-w-md flex-col gap-1.5">
        <Label htmlFor="sdr-config-agent">Agente</Label>
        <Select value={playbookId ?? undefined} onValueChange={setPicked}>
          <SelectTrigger id="sdr-config-agent">
            <SelectValue placeholder="Escolha o agente" />
          </SelectTrigger>
          <SelectContent>
            {sortDefaultFirst(playbooks, defaultPlaybookId).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {agentOptionLabel(p, defaultPlaybookId)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {playbookId && (
        <AgentForm key={playbookId} workspaceId={workspaceId} playbookId={playbookId} />
      )}
    </div>
  );
}

function AgentForm({ workspaceId, playbookId }: { workspaceId: string; playbookId: string }) {
  const qc = useQueryClient();
  const load = useServerFn(getSdrAgentConfig);
  const save = useServerFn(saveSdrAgentConfig);
  const logsFn = useServerFn(getSdrAgentLogs);
  const key = ["sdr-agent-config", playbookId];
  const q = useQuery({ queryKey: key, queryFn: () => load({ data: { workspaceId, playbookId } }) });
  const logsQ = useQuery({
    queryKey: ["sdr-agent-logs", playbookId],
    queryFn: () => logsFn({ data: { workspaceId, playbookId } }),
  });
  const members = useWorkspaceMembers();

  const [cfg, setCfg] = useState<AgentConfig | null>(null);
  const [agent, setAgent] = useState<{
    qualification_prompt: string;
    handoff_score: number;
    opportunity_min_score: number;
    max_messages: number;
    follow_up_hours: number;
    max_follow_ups: number;
    mode: "supervised" | "auto";
  } | null>(null);

  useEffect(() => {
    if (!q.data || cfg) return;
    setCfg(q.data.config as AgentConfig);
    setAgent({
      qualification_prompt: q.data.agent.qualification_prompt ?? "",
      handoff_score: q.data.agent.handoff_score,
      opportunity_min_score: q.data.agent.opportunity_min_score,
      max_messages: q.data.agent.max_messages,
      follow_up_hours: q.data.agent.follow_up_hours,
      max_follow_ups: q.data.agent.max_follow_ups,
      mode: q.data.agent.mode === "auto" ? "auto" : "supervised",
    });
  }, [q.data, cfg]);

  const saveM = useMutation({
    mutationFn: () => save({ data: { workspaceId, playbookId, config: cfg, agent: agent ?? {} } }),
    onSuccess: async () => {
      toast.success("Configuração do agente salva");
      await qc.invalidateQueries({ queryKey: key });
      await qc.invalidateQueries({ queryKey: ["sdr-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading || !cfg || !agent)
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando configuração…
      </div>
    );
  if (q.error)
    return (
      <EmptyState
        title="Não foi possível carregar a configuração"
        description={(q.error as Error).message}
        action={<Button onClick={() => q.refetch()}>Tentar novamente</Button>}
      />
    );

  const opts = q.data!.options;
  const set = <K extends keyof AgentConfig>(k: K, v: AgentConfig[K]) =>
    setCfg((c) => (c ? { ...c, [k]: v } : c));
  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <ProductPanel className="space-y-5 p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Configuração deste agente</h3>
          <p className="text-xs text-muted-foreground">
            Vale somente para <strong>{q.data!.agent.name}</strong>. A configuração do workspace
            controla apenas liga/desliga e limites técnicos.
          </p>
        </div>
        <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
          {saveM.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar
        </Button>
      </div>

      <FormSection
        title="Ferramentas permitidas"
        description="O que este agente pode fazer sozinho."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {SDR_TOOLS.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={cfg.allowed_tools.includes(t)}
                onCheckedChange={() =>
                  set("allowed_tools", toggleIn(cfg.allowed_tools, t) as SdrTool[])
                }
                aria-label={TOOL_LABEL[t]}
              />
              {TOOL_LABEL[t]}
            </label>
          ))}
        </div>
      </FormSection>

      <FormSection
        title="Catálogo e materiais"
        description="Sem seleção, o agente usa todo o portfólio ativo e os materiais aprovados."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Ofertas liberadas</Label>
            {opts.offers.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma oferta cadastrada.</p>
            ) : (
              opts.offers.map((o) => (
                <label key={o.offer_key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={cfg.offer_keys.includes(o.offer_key)}
                    onCheckedChange={() => set("offer_keys", toggleIn(cfg.offer_keys, o.offer_key))}
                  />
                  {o.name}
                  {o.status !== "active" && (
                    <Badge variant="outline" className="ml-1">
                      {o.status}
                    </Badge>
                  )}
                </label>
              ))
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Materiais liberados</Label>
            {opts.materials.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum material cadastrado.</p>
            ) : (
              opts.materials.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    disabled={!cfg.allowed_tools.includes("material")}
                    checked={cfg.material_ids.includes(m.id)}
                    onCheckedChange={() => set("material_ids", toggleIn(cfg.material_ids, m.id))}
                  />
                  {m.title}
                  {!m.approved && (
                    <Badge variant="outline" className="ml-1">
                      não aprovado
                    </Badge>
                  )}
                </label>
              ))
            )}
          </div>
        </div>
      </FormSection>

      <FormSection title="Qualificação e CRM" description="Questionário e notas deste agente.">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cfg-quest">Questionário</Label>
            <Select
              value={cfg.questionnaire_id ?? NONE}
              onValueChange={(v) => set("questionnaire_id", v === NONE ? null : v)}
            >
              <SelectTrigger id="cfg-quest">
                <SelectValue placeholder="Sem questionário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem questionário</SelectItem>
                {opts.questionnaires.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-min">Nota mínima para oportunidade</Label>
            <Input
              id="cfg-min"
              type="number"
              min={0}
              max={100}
              value={agent.opportunity_min_score}
              onChange={(e) =>
                setAgent({ ...agent, opportunity_min_score: Number(e.target.value) })
              }
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="cfg-prompt">Orientações do roteiro (prompt do playbook)</Label>
            <Textarea
              id="cfg-prompt"
              rows={8}
              className={TEXTAREA_CLASS}
              value={agent.qualification_prompt}
              onChange={(e) => setAgent({ ...agent, qualification_prompt: e.target.value })}
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Responsável e agenda"
        description="Quem recebe a conversa e qual página de agendamento o agente pode oferecer."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cfg-owner">Responsável</Label>
            <Select
              value={cfg.assigned_to ?? NONE}
              onValueChange={(v) => set("assigned_to", v === NONE ? null : v)}
            >
              <SelectTrigger id="cfg-owner">
                <SelectValue placeholder="Sem responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem responsável</SelectItem>
                {(members.data ?? []).map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.full_name || m.user_id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-booking">Página de agendamento</Label>
            <Select
              value={cfg.booking_page_id ?? NONE}
              onValueChange={(v) => set("booking_page_id", v === NONE ? null : v)}
            >
              <SelectTrigger id="cfg-booking" disabled={!cfg.allowed_tools.includes("schedule")}>
                <SelectValue placeholder="Sem agenda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem agenda</SelectItem>
                {opts.bookingPages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Handoff e ritmo"
        description="Quando passar para humano e com que cadência."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="cfg-handoff">Nota para handoff</Label>
            <Input
              id="cfg-handoff"
              type="number"
              min={0}
              max={100}
              value={agent.handoff_score}
              onChange={(e) => setAgent({ ...agent, handoff_score: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-fu">Horas até a retomada</Label>
            <Input
              id="cfg-fu"
              type="number"
              min={1}
              max={720}
              value={agent.follow_up_hours}
              onChange={(e) => setAgent({ ...agent, follow_up_hours: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-maxfu">Máximo de retomadas</Label>
            <Input
              id="cfg-maxfu"
              type="number"
              min={0}
              max={10}
              value={agent.max_follow_ups}
              onChange={(e) => setAgent({ ...agent, max_follow_ups: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Switch
            id="cfg-mode"
            checked={agent.mode === "auto"}
            onCheckedChange={(v) => setAgent({ ...agent, mode: v ? "auto" : "supervised" })}
          />
          <Label htmlFor="cfg-mode" className="text-sm">
            Enviar sem revisão humana (modo automático)
          </Label>
        </div>
      </FormSection>

      <FormSection title="Canais" description="Canais suportados por este agente hoje.">
        <div className="flex items-center gap-2 text-sm">
          <Checkbox checked disabled aria-label="WhatsApp" />
          WhatsApp
          <span className="text-xs text-muted-foreground">
            (e-mail e voz ainda não são executados pelo agente)
          </span>
        </div>
      </FormSection>

      <FormSection title="Guardrails" description="Limites fixos que o agente não pode quebrar.">
        <div className="space-y-3">
          <div className="flex max-w-sm flex-col gap-1.5">
            <Label htmlFor="cfg-wait">Tempo de aguardo do cliente (segundos)</Label>
            <Input
              id="cfg-wait"
              type="number"
              inputMode="numeric"
              min={0}
              max={300}
              step={1}
              value={cfg.guardrails.customer_wait_seconds}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value));
                set("guardrails", {
                  ...cfg.guardrails,
                  customer_wait_seconds: Number.isFinite(n) ? Math.min(300, Math.max(0, n)) : 0,
                });
              }}
              aria-describedby="cfg-wait-help"
            />
            <p id="cfg-wait-help" className="text-xs text-muted-foreground">
              Após a última mensagem do cliente, o agente espera esse tempo. Mensagens que chegarem
              nesse intervalo são juntadas e recebem uma única resposta. 0 = responde na hora.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="cfg-nopricing"
              checked={cfg.guardrails.no_pricing}
              onCheckedChange={(v) => set("guardrails", { ...cfg.guardrails, no_pricing: v })}
            />
            <Label htmlFor="cfg-nopricing" className="text-sm">
              Nunca falar de preços, descontos ou prazos comerciais
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="cfg-attachmat"
              checked={cfg.guardrails.attach_materials}
              onCheckedChange={(v) => set("guardrails", { ...cfg.guardrails, attach_materials: v })}
            />
            <Label htmlFor="cfg-attachmat" className="text-sm">
              Anexar links de materiais (páginas do site) quando o cliente pedir
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="cfg-humanopp"
              checked={cfg.guardrails.require_human_for_opportunity}
              onCheckedChange={(v) =>
                set("guardrails", { ...cfg.guardrails, require_human_for_opportunity: v })
              }
            />
            <Label htmlFor="cfg-humanopp" className="text-sm">
              Exigir revisão humana antes de abrir oportunidade
            </Label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-maxq">Perguntas por mensagem</Label>
            <Input
              id="cfg-maxq"
              type="number"
              min={1}
              max={2}
              className="w-24"
              value={cfg.guardrails.max_questions}
              onChange={(e) =>
                set("guardrails", {
                  ...cfg.guardrails,
                  max_questions: Math.min(2, Math.max(1, Number(e.target.value) || 1)),
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-rules">Regras adicionais</Label>
            <Textarea
              id="cfg-rules"
              rows={6}
              className={TEXTAREA_CLASS}
              value={cfg.guardrails.extra_rules}
              onChange={(e) =>
                set("guardrails", { ...cfg.guardrails, extra_rules: e.target.value })
              }
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Fontes de conhecimento"
        description="Links e notas que entram no prompt deste agente."
      >
        <div className="space-y-2">
          {cfg.kb_sources.map((s, i) => (
            <div key={i} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <Input
                value={s.title}
                placeholder="Título"
                onChange={(e) => {
                  const next = [...cfg.kb_sources];
                  next[i] = { ...s, title: e.target.value };
                  set("kb_sources", next);
                }}
                aria-label={`Título da fonte ${i + 1}`}
              />
              <Input
                value={s.url}
                placeholder="https://…"
                onChange={(e) => {
                  const next = [...cfg.kb_sources];
                  next[i] = { ...s, url: e.target.value };
                  set("kb_sources", next);
                }}
                aria-label={`Link da fonte ${i + 1}`}
              />
              <Button
                variant="ghost"
                onClick={() =>
                  set(
                    "kb_sources",
                    cfg.kb_sources.filter((_, j) => j !== i),
                  )
                }
              >
                Remover
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => set("kb_sources", [...cfg.kb_sources, { title: "", url: "", note: "" }])}
          >
            Adicionar fonte
          </Button>
        </div>
      </FormSection>

      <FormSection title="Logs do agente" description="Últimos turnos processados por este agente.">
        {logsQ.isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        ) : logsQ.isError ? (
          <div className="flex items-center gap-2 text-xs text-destructive">
            Não foi possível carregar os logs.
            <Button size="sm" variant="outline" onClick={() => logsQ.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (logsQ.data?.items.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum turno registrado para este agente.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {logsQ.data!.items.slice(0, 10).map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-2">
                <Badge variant={j.status === "failed" ? "destructive" : "secondary"}>
                  {j.status}
                </Badge>
                <span className="text-muted-foreground">{j.kind}</span>
                <span className="text-muted-foreground">
                  {new Date(j.created_at as string).toLocaleString("pt-BR")}
                </span>
                {j.error && <span className="text-destructive">{j.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </FormSection>
    </ProductPanel>
  );
}
