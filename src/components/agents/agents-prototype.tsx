/**
 * PROTÓTIPO VISUAL (dados de demonstração) — Central de Agentes de IA.
 * Não grava nada, não chama servidor e não envia mensagens. Serve apenas para
 * aprovação do esboço exigido por AGENTS.md ("Redesigns relevantes exigem
 * mockup aprovado").
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, EmptyState } from "@/components/techhire/ui";
import {
  Bot,
  Copy,
  Archive,
  Plus,
  ArrowLeft,
  ArrowRight,
  Save,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Send,
} from "lucide-react";

type View = "list" | "wizard" | "studio" | "record";

const DEMO_AGENTS = [
  {
    id: "a1",
    name: "Agente Vendas",
    kind: "Prospecção (SDR)",
    status: "Ativo · homologação",
    host: "Closer: Ana Souza (exemplo)",
    channels: "WhatsApp piloto",
    version: "v3 publicada · v4 rascunho",
  },
  {
    id: "a2",
    name: "Agente Técnico",
    kind: "Projeto do cliente",
    status: "Rascunho",
    host: "P.O.: Bruno Lima (exemplo)",
    channels: "Nenhum canal",
    version: "v1 rascunho",
  },
  {
    id: "a3",
    name: "Agente Receptivo",
    kind: "Receptivo",
    status: "Rascunho",
    host: "Equipe: Atendimento (exemplo)",
    channels: "Nenhum canal",
    version: "v1 rascunho",
  },
];

const STEPS = [
  "Identidade e finalidade",
  "Persona e instruções",
  "Conhecimento e escopo",
  "Fluxo visual",
  "Ferramentas, responsáveis e agenda",
  "Canais e roteamento",
  "Testar",
  "Revisão e lançamento",
];

const PALETTE: Record<string, { label: string; available: boolean }[]> = {
  Blocos: [
    { label: "Agente", available: true },
    { label: "Classificar", available: true },
    { label: "Proteções", available: true },
    { label: "Aprovação", available: true },
    { label: "Condição", available: true },
    { label: "Enviar resposta", available: true },
    { label: "HTTP Request", available: false },
    { label: "Fim", available: true },
    { label: "Nota", available: true },
  ],
  "Buscar dados": [
    { label: "Buscar cliente", available: true },
    { label: "Buscar KB", available: true },
    { label: "Consultar catálogo", available: true },
    { label: "Dados empresa", available: false },
  ],
  "CRM / Leads": [
    { label: "Capturar lead", available: true },
    { label: "Agendar reunião", available: true },
    { label: "Etiquetar conversa", available: false },
  ],
  Prospecção: [{ label: "Prospecção", available: true }],
  Operação: [
    { label: "Escalar pra humano", available: true },
    { label: "Passar a outro agente", available: true },
    { label: "Avaliar atendimento", available: false },
  ],
};

const NODES = [
  { id: "start", label: "Início", x: 40, y: 140 },
  { id: "guard", label: "Proteções", x: 200, y: 140 },
  { id: "agent", label: "Agente", x: 380, y: 100 },
  { id: "human", label: "Escalar pra humano", x: 380, y: 230 },
  { id: "end", label: "Fim", x: 580, y: 140 },
];
const EDGES: [string, string, string?][] = [
  ["start", "guard"],
  ["guard", "agent", "Passou"],
  ["guard", "human", "Bloqueou"],
  ["agent", "end"],
  ["human", "end"],
];

function DemoBanner() {
  return (
    <div
      role="note"
      className="rounded-md border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-foreground"
    >
      <strong>Protótipo para aprovação.</strong> Todos os nomes, números e conversas são de
      demonstração. Nada é salvo nem enviado.
    </div>
  );
}

function AgentList({ go }: { go: (v: View) => void }) {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Agentes de IA"
        title="Seus agentes"
        description="Cada agente tem persona, conhecimento, fluxo, agenda e canais próprios."
        primaryAction={
          <Button onClick={() => go("wizard")}>
            <Plus className="mr-2 h-4 w-4" /> Novo agente
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {DEMO_AGENTS.map((a) => (
          <div key={a.id} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" aria-hidden />
                <div>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.kind}</p>
                </div>
              </div>
              <Badge variant="outline">{a.status}</Badge>
            </div>
            <dl className="text-sm space-y-1 text-muted-foreground">
              <div>{a.host}</div>
              <div>{a.channels}</div>
              <div>{a.version}</div>
            </dl>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => go("studio")}>
                Abrir
              </Button>
              <Button size="sm" variant="outline" aria-label={`Duplicar ${a.name}`}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" aria-label={`Arquivar ${a.name}`}>
                <Archive className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Duplicar copia persona, fluxo e conhecimento próprio; não copia canais, segredos nem ativa
        nada.
      </p>
    </div>
  );
}

function FlowCanvas() {
  const [sel, setSel] = useState<string>("agent");
  const pos = Object.fromEntries(NODES.map((n) => [n.id, n]));
  return (
    <div className="grid gap-3 lg:grid-cols-[200px_1fr_280px]">
      <aside className="rounded-lg border bg-card p-3 space-y-3 text-sm max-h-[460px] overflow-auto">
        {Object.entries(PALETTE).map(([g, items]) => (
          <div key={g}>
            <p className="text-xs font-medium text-muted-foreground mb-1">{g}</p>
            {items.map((i) => (
              <div
                key={i.label}
                className={`rounded px-2 py-1 ${i.available ? "hover:bg-muted cursor-grab" : "opacity-50"}`}
                title={
                  i.available ? "Arraste para o canvas" : "Indisponível: integração não conectada"
                }
              >
                {i.label}
                {!i.available && <span className="ml-1 text-xs">(indisponível)</span>}
              </div>
            ))}
          </div>
        ))}
      </aside>
      <div className="relative h-[460px] rounded-lg border bg-muted/30 overflow-hidden">
        <svg className="absolute inset-0 h-full w-full" aria-hidden>
          {EDGES.map(([a, b, l]) => {
            const s = pos[a];
            const t = pos[b];
            return (
              <g key={a + b}>
                <line
                  x1={s.x + 130}
                  y1={s.y + 20}
                  x2={t.x}
                  y2={t.y + 20}
                  className="stroke-border"
                  strokeWidth={2}
                />
                {l && (
                  <text
                    x={(s.x + 130 + t.x) / 2}
                    y={(s.y + t.y) / 2 + 14}
                    className="fill-muted-foreground text-[11px]"
                  >
                    {l}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {NODES.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => setSel(n.id)}
            style={{ left: n.x, top: n.y }}
            className={`absolute w-[130px] rounded-md border bg-card px-3 py-2 text-left text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${sel === n.id ? "border-primary ring-1 ring-primary" : ""}`}
          >
            {n.label}
          </button>
        ))}
        <div
          className="absolute bottom-2 right-2 h-16 w-24 rounded border bg-card/90 p-1"
          aria-label="Minimapa"
        >
          {NODES.map((n) => (
            <div
              key={n.id}
              className="absolute h-1.5 w-4 rounded-sm bg-primary/60"
              style={{ left: 4 + n.x / 8, top: 4 + n.y / 8 }}
            />
          ))}
        </div>
        <div className="absolute bottom-2 left-2 flex gap-1">
          <Button size="sm" variant="outline" aria-label="Aproximar">
            +
          </Button>
          <Button size="sm" variant="outline" aria-label="Afastar">
            −
          </Button>
        </div>
      </div>
      <aside className="rounded-lg border bg-card p-3 space-y-3 text-sm">
        <p className="font-medium">Bloco: {pos[sel].label}</p>
        {sel === "agent" ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="p-tools">Ferramentas</Label>
              <p id="p-tools" className="text-muted-foreground">
                Buscar KB · Consultar catálogo · Agendar reunião · Escalar pra humano
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-max">Máximo de passos</Label>
              <Input id="p-max" defaultValue="8" />
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">Configurações do bloco aparecem aqui.</p>
        )}
        <div className="rounded border border-success/40 bg-success/10 p-2 text-xs">
          <CheckCircle2 className="inline h-3 w-3 mr-1" /> Grafo válido: início único, sem blocos
          soltos.
        </div>
      </aside>
    </div>
  );
}

function TestChat() {
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
      <div className="rounded-lg border bg-card p-4 space-y-3 min-h-[320px]">
        <div className="ml-auto max-w-[70%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
          Precisamos de 2 Delphi Sênior e 3 Pleno por 2 anos. O orçamento ainda está em análise.
        </div>
        <div className="max-w-[70%] text-sm">
          Com o orçamento em análise, dá para já dimensionar a equipe. Vocês têm uma data prevista
          para começar?
        </div>
        <div className="flex gap-2 pt-4">
          <Textarea
            aria-label="Mensagem de teste"
            placeholder="Enter envia, Shift+Enter quebra linha"
          />
          <Button aria-label="Enviar teste">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <aside className="rounded-lg border bg-card p-3 text-sm space-y-1">
        <p className="font-medium">Trace do turno (exemplo)</p>
        <p>Início → Proteções (Passou) → Agente → Fim</p>
        <p className="text-muted-foreground">Ferramentas simuladas · sem WhatsApp, CRM ou agenda</p>
      </aside>
    </div>
  );
}

function Wizard({ go }: { go: (v: View) => void }) {
  const [step, setStep] = useState(0);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => go("list")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Agentes
        </Button>
        <Button variant="outline">
          <Save className="mr-2 h-4 w-4" /> Salvar rascunho
        </Button>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">
          Etapa {step + 1} de {STEPS.length}
        </p>
        <h2 className="text-xl font-semibold">{STEPS[step]}</h2>
        <Progress
          value={((step + 1) / STEPS.length) * 100}
          className="mt-2"
          aria-label="Progresso"
        />
      </div>
      <ol className="flex flex-wrap gap-1 text-xs">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => setStep(i)}
              className={`rounded px-2 py-1 border ${i === step ? "border-primary text-primary" : "text-muted-foreground"}`}
            >
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>
      <div className="rounded-lg border bg-card p-4 space-y-3">
        {step === 0 && (
          <>
            <Label htmlFor="w-name">Nome do agente</Label>
            <Input id="w-name" defaultValue="Agente Técnico" />
            <Label htmlFor="w-kind">Finalidade</Label>
            <Input id="w-kind" defaultValue="Responder dúvidas técnicas do projeto do cliente" />
          </>
        )}
        {step === 1 && (
          <>
            <Label htmlFor="w-persona">Instruções</Label>
            <Textarea
              id="w-persona"
              defaultValue="Tom consultivo, direto, sem jargão. Uma pergunta por vez."
            />
          </>
        )}
        {step === 2 && (
          <p className="text-sm">
            Escopo: <strong>Só este agente</strong> · Projeto: <em>Projeto X (exemplo)</em>.
            Documentos de outros projetos ficam inacessíveis.
          </p>
        )}
        {step === 3 && <FlowCanvas />}
        {step === 4 && (
          <>
            <Label htmlFor="w-host">Anfitrião da agenda (escolha obrigatória)</Label>
            <Input id="w-host" defaultValue="Bruno Lima — P.O. (exemplo)" />
            <p className="text-xs text-muted-foreground">
              Sem escolha, o agente não agenda. Nenhum padrão global é usado.
            </p>
          </>
        )}
        {step === 5 && (
          <p className="text-sm">
            Regra de roteamento: inbound do contato vinculado ao Projeto X → este agente. Conflito
            com outro agente → triagem humana.
          </p>
        )}
        {step === 6 && <TestChat />}
        {step === 7 && (
          <ul className="text-sm space-y-1">
            <li>
              <CheckCircle2 className="inline h-4 w-4 text-success mr-1" />
              Função definida
            </li>
            <li>
              <CheckCircle2 className="inline h-4 w-4 text-success mr-1" />
              Fontes de conhecimento
            </li>
            <li>
              <AlertTriangle className="inline h-4 w-4 text-warning mr-1" />
              Nenhum canal conectado
            </li>
            <li className="flex items-center gap-2 pt-2">
              <Switch id="w-active" disabled />{" "}
              <Label htmlFor="w-active">Agente ativo (desligado)</Label>
            </li>
          </ul>
        )}
      </div>
      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <Button onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : go("studio"))}>
          {step < STEPS.length - 1 ? "Próximo" : "Concluir rascunho"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Studio({ go }: { go: (v: View) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => go("list")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <Button>
          <Save className="mr-2 h-4 w-4" /> Salvar fluxo
        </Button>
      </div>
      <Tabs defaultValue="flow">
        <TabsList>
          <TabsTrigger value="flow">Fluxo</TabsTrigger>
          <TabsTrigger value="test">Testar</TabsTrigger>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
          <TabsTrigger value="kb">Conhecimento</TabsTrigger>
          <TabsTrigger value="launch">Lançamento</TabsTrigger>
        </TabsList>
        <TabsContent value="flow" className="mt-4">
          <FlowCanvas />
        </TabsContent>
        <TabsContent value="test" className="mt-4">
          <TestChat />
        </TabsContent>
        <TabsContent value="metrics" className="mt-4">
          <EmptyState
            title="Sem dados de produção para este agente"
            description="Métricas por versão e origem (receptivo/prospecção), p50/p95 de fila, IA e envio aparecerão aqui. Testes não contam."
          />
        </TabsContent>
        <TabsContent value="kb" className="mt-4">
          <div className="rounded-lg border bg-card p-4 text-sm space-y-2">
            <p className="font-medium">
              Catálogo de serviços WK (exemplo) · Texto · Processado · 12 trechos
            </p>
            <p className="text-muted-foreground">Escopo: Todos os agentes</p>
            <p className="font-medium pt-2">Perguntas sem resposta</p>
            <p className="text-muted-foreground">“Vocês atendem fora do Brasil?” (exemplo)</p>
          </div>
        </TabsContent>
        <TabsContent value="launch" className="mt-4">
          <div className="rounded-lg border bg-card p-4 text-sm space-y-2">
            <p>Modo homologação: somente números autorizados</p>
            <p className="text-muted-foreground">Canais: WhatsApp piloto (exemplo)</p>
            <Button variant="outline" size="sm">
              Conferir novamente
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RecordConversations() {
  const rows = [
    {
      ch: "WhatsApp",
      agent: "Agente Vendas v3",
      owner: "Ana Souza",
      when: "07/10 10:12",
      status: "Aberta",
      ctx: "Negócio: Squad Delphi",
    },
    {
      ch: "WhatsApp",
      agent: "Agente Técnico v1 → humano",
      owner: "Bruno Lima",
      when: "06/10 15:40",
      status: "Com humano",
      ctx: "Projeto X",
    },
  ];
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Contato (exemplo)"
        title="Maria Exemplo"
        description="Empresa Exemplo Ltda"
      />
      <section className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <MessageSquare className="h-4 w-4" aria-hidden />
          <h3 className="font-medium">Conversas</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Canal</th>
              <th>Agente/autor</th>
              <th>Responsável</th>
              <th>Último</th>
              <th>Status</th>
              <th>Contexto</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.when} className="border-t">
                <td className="px-4 py-2">{r.ch}</td>
                <td>{r.agent}</td>
                <td>{r.owner}</td>
                <td>{r.when}</td>
                <td>
                  <Badge variant="outline">{r.status}</Badge>
                </td>
                <td>{r.ctx}</td>
                <td>
                  <Button size="sm" variant="link">
                    Abrir conversa
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-2 text-xs text-muted-foreground border-t">
          Conversa sem contexto definido fica em triagem — não é anexada a todos os
          negócios/projetos.
        </p>
      </section>
    </div>
  );
}

export function AgentsPrototype() {
  const [view, setView] = useState<View>("list");
  return (
    <div className="p-6 space-y-4">
      <DemoBanner />
      <nav aria-label="Telas do protótipo" className="flex flex-wrap gap-2">
        {(
          [
            ["list", "Lista de agentes"],
            ["wizard", "Wizard"],
            ["studio", "Estúdio do agente"],
            ["record", "Ficha com conversas"],
          ] as [View, string][]
        ).map(([v, l]) => (
          <Button
            key={v}
            size="sm"
            variant={view === v ? "default" : "outline"}
            onClick={() => setView(v)}
          >
            {l}
          </Button>
        ))}
      </nav>
      {view === "list" && <AgentList go={setView} />}
      {view === "wizard" && <Wizard go={setView} />}
      {view === "studio" && <Studio go={setView} />}
      {view === "record" && <RecordConversations />}
    </div>
  );
}
