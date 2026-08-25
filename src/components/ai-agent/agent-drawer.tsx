import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Sparkles, Check, XCircle, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import {
  agentCreateContact,
  agentCreateCompany,
  agentCreateLead,
  agentUpdateContact,
  agentUpdateLead,
  agentCreateDeal,
  agentCreateTicket,
  agentCreateActivity,
  agentCreateTask,
  agentCreateMeeting,
} from "@/lib/ai-agent/tools.functions";

const PROPOSAL_TO_FN: Record<
  string,
  (args: { data: unknown }) => Promise<{ summary: string; url?: string }>
> = {
  proposeCreateContact: (a) => agentCreateContact(a as never),
  proposeCreateCompany: (a) => agentCreateCompany(a as never),
  proposeCreateLead: (a) => agentCreateLead(a as never),
  proposeUpdateContact: (a) => agentUpdateContact(a as never),
  proposeUpdateLead: (a) => agentUpdateLead(a as never),
  proposeCreateDeal: (a) => agentCreateDeal(a as never),
  proposeCreateTicket: (a) => agentCreateTicket(a as never),
  proposeCreateActivity: (a) => agentCreateActivity(a as never),
  proposeCreateTask: (a) => agentCreateTask(a as never),
  proposeCreateMeeting: (a) => agentCreateMeeting(a as never),
};

const PROPOSAL_LABELS: Record<string, string> = {
  proposeCreateContact: "Criar contato",
  proposeCreateCompany: "Criar empresa",
  proposeCreateLead: "Criar lead",
  proposeUpdateContact: "Atualizar contato",
  proposeUpdateLead: "Atualizar lead",
  proposeCreateDeal: "Criar negócio",
  proposeCreateTicket: "Criar chamado",
  proposeCreateActivity: "Registrar atividade",
  proposeCreateTask: "Criar tarefa",
  proposeCreateMeeting: "Agendar reunião",
};

function ProposalCard({
  toolName,
  payload,
}: {
  toolName: string;
  payload: Record<string, unknown>;
}) {
  const queryClient = useQueryClient();
  const approvalKey = useMemo(
    () => `ai-agent:proposal:${toolName}:${JSON.stringify(payload, Object.keys(payload).sort())}`,
    [payload, toolName],
  );
  const [result, setResult] = useState<{ summary: string; url?: string } | null>(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(approvalKey) : null;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { summary: string; url?: string };
    } catch {
      return null;
    }
  });
  const [state, setState] = useState<"pending" | "approving" | "done" | "rejected">(() =>
    result ? "done" : "pending",
  );
  const isUpdate = toolName.toLowerCase().includes("update");

  const handleApprove = async () => {
    const fn = PROPOSAL_TO_FN[toolName];
    if (!fn) return;
    setState("approving");
    try {
      const res = await fn({ data: payload });
      setResult(res);
      setState("done");
      window.localStorage.setItem(approvalKey, JSON.stringify(res));
      await queryClient.invalidateQueries();
      toast.success(res.summary);
    } catch (e) {
      setState("pending");
      toast.error(e instanceof Error ? e.message : "Falha ao executar");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{PROPOSAL_LABELS[toolName] ?? toolName}</span>
        {state === "done" && (
          <span className="text-xs font-medium text-emerald-600">Concluído</span>
        )}
        {state === "rejected" && <span className="text-xs text-muted-foreground">Rejeitado</span>}
      </div>
      <div className="mt-2 rounded bg-muted/50 p-2 text-xs">
        <dl className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
          {Object.entries(payload)
            .filter(([, v]) => v !== undefined && v !== null && v !== "")
            .map(([k, v]) => (
              <div key={k} className="flex gap-1">
                <dt className="text-muted-foreground">{k}:</dt>
                <dd className="truncate">{String(v)}</dd>
              </div>
            ))}
        </dl>
      </div>
      {state === "pending" && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={handleApprove}>
            <Check className="mr-1 h-3.5 w-3.5" /> Aprovar e {isUpdate ? "atualizar" : "criar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setState("rejected")}>
            <XCircle className="mr-1 h-3.5 w-3.5" /> Rejeitar
          </Button>
        </div>
      )}
      {state === "approving" && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
          {isUpdate ? "Atualizando..." : "Criando..."}
        </div>
      )}
      {state === "done" && result?.url && (
        <a href={result.url} className="mt-2 inline-block text-xs text-primary underline">
          Abrir registro
        </a>
      )}
    </div>
  );
}

export function AgentDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [chatId, setChatId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`,
  );
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent/chat",
        body: () => ({
          sessionId: chatId,
          pagePath: window.location.pathname,
        }),
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers = new Headers();
          if (token) headers.set("Authorization", `Bearer ${token}`);
          return headers;
        },
      }),
    [chatId],
  );
  const { messages, sendMessage, status, setMessages } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!open || !user) return;
    const userId = user.id;
    let cancelled = false;
    async function loadHistory() {
      setHistoryLoaded(false);
      const storedId = window.localStorage.getItem("ai-agent:active-session-id");
      let sessionId = storedId;

      if (!sessionId) {
        const { data: latest } = await supabase
          .from("copilot_sessions")
          .select("id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        sessionId = latest?.id ?? chatId;
      }

      const validSessionId =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)
          ? sessionId
          : crypto.randomUUID();

      const { data: rows } = await supabase
        .from("copilot_messages")
        .select("id, role, parts")
        .eq("session_id", validSessionId)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      const loaded = (rows ?? [])
        .filter((row) => row.role === "user" || row.role === "assistant" || row.role === "system")
        .map((row) => ({
          id: row.id,
          role: row.role as UIMessage["role"],
          parts: Array.isArray(row.parts) ? (row.parts as UIMessage["parts"]) : [],
        }));

      window.localStorage.setItem("ai-agent:active-session-id", validSessionId);
      setChatId(validSessionId);
      setInitialMessages(loaded);
      setMessages(loaded);
      setHistoryLoaded(true);
    }

    loadHistory().catch(() => {
      if (!cancelled) setHistoryLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [chatId, open, setMessages, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const busy = status === "submitted" || status === "streaming";

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Assistente do CRM
          </SheetTitle>
        </SheetHeader>
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {!historyLoaded && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando conversa…
            </div>
          )}
          {historyLoaded && messages.length === 0 && (
            <div className="text-sm text-muted-foreground">
              Peça para buscar, atualizar ou criar contatos, leads, negócios, chamados, tarefas ou
              reuniões. Ex.:
              <div className="mt-2 space-y-1">
                <div className="text-xs">• "Atualize o e-mail do lead Bruno Linter"</div>
                <div className="text-xs">
                  • "Registre uma tarefa para ligar amanhã ao contato Maria"
                </div>
                <div className="text-xs">
                  • "Abra um chamado em FI - Solicitações para criar contrato"
                </div>
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className="space-y-2">
              {m.parts.map((part, i) => {
                if (part.type === "text") {
                  return m.role === "user" ? (
                    <div
                      key={i}
                      className="ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                    >
                      {part.text}
                    </div>
                  ) : (
                    <div
                      key={i}
                      className="prose prose-sm max-w-none text-sm text-foreground dark:prose-invert"
                    >
                      <ReactMarkdown>{part.text}</ReactMarkdown>
                    </div>
                  );
                }
                // AI SDK tool part shape: type = `tool-<name>`; state includes output-available
                if (typeof part.type === "string" && part.type.startsWith("tool-")) {
                  const p = part as unknown as {
                    type: string;
                    state?: string;
                    output?: unknown;
                    input?: unknown;
                  };
                  const toolName = p.type.slice("tool-".length);
                  const output = p.output as
                    | { __proposal?: boolean; payload?: Record<string, unknown> }
                    | undefined;
                  if (output?.__proposal && output.payload) {
                    return <ProposalCard key={i} toolName={toolName} payload={output.payload} />;
                  }
                  // Read tools: mostrar chip discreto
                  return (
                    <div key={i} className="text-xs text-muted-foreground">
                      🔍 {toolName}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          ))}
          {status === "submitted" && <div className="text-xs text-muted-foreground">Pensando…</div>}
        </div>
        <div className="border-t p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Como posso ajudar?"
              className="min-h-[44px] max-h-40 resize-none"
              rows={1}
              autoFocus
            />
            <Button size="icon" onClick={submit} disabled={!historyLoaded || busy || !input.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// O gatilho flutuante vive em `@/components/ai-agent/agent-trigger` para que
// este módulo (AI SDK + react-markdown) só seja baixado ao abrir o assistente.
