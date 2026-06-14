import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

export const Route = createFileRoute("/widget/$workspaceId")({
  component: WidgetPage,
});

type Msg = { id: string; direction: "inbound" | "outbound"; body: string; created_at: string };

function visitorIdLocal(): string {
  if (typeof window === "undefined") return "anon";
  const KEY = "lc_visitor_id";
  let v = localStorage.getItem(KEY);
  if (!v) {
    v = "v_" + crypto.randomUUID().replace(/-/g, "").slice(0, 22);
    localStorage.setItem(KEY, v);
  }
  return v;
}

function WidgetPage() {
  const { workspaceId } = Route.useParams();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [started, setStarted] = useState(false);
  const sinceRef = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function startSession() {
    const visitorId = visitorIdLocal();
    const r = await fetch("/api/public/widget/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: workspaceId,
        visitor_id: visitorId,
        visitor_name: name || undefined,
        visitor_email: email || undefined,
        visitor_url: document.referrer || undefined,
      }),
    });
    const j = await r.json();
    if (j.session_id) {
      setSessionId(j.session_id);
      setStarted(true);
    }
  }

  useEffect(() => {
    if (!sessionId) return;
    const visitorId = visitorIdLocal();
    let stopped = false;
    async function tick() {
      while (!stopped) {
        const url =
          `/api/public/widget/messages?session_id=${sessionId}&visitor_id=${visitorId}` +
          (sinceRef.current ? `&since=${encodeURIComponent(sinceRef.current)}` : "");
        try {
          const r = await fetch(url);
          const j = await r.json();
          const newMsgs: Msg[] = j.messages ?? [];
          if (newMsgs.length) {
            setMessages((prev) => [...prev, ...newMsgs]);
            sinceRef.current = newMsgs[newMsgs.length - 1].created_at;
            setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
          }
        } catch {
          /* ignore */
        }
        await new Promise((res) => setTimeout(res, 2500));
      }
    }
    tick();
    return () => {
      stopped = true;
    };
  }, [sessionId]);

  async function send() {
    const visitorId = visitorIdLocal();
    if (!sessionId || !draft.trim()) return;
    const body = draft.trim();
    setDraft("");
    await fetch("/api/public/widget/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, visitor_id: visitorId, body }),
    });
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground text-sm">
      <header className="px-4 py-3 border-b bg-primary text-primary-foreground">
        <div className="font-semibold">Fale com a gente</div>
        <div className="text-xs opacity-80">Responderemos em instantes.</div>
      </header>

      {!started ? (
        <div className="p-4 flex-1 flex flex-col gap-2 justify-center">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            className="border rounded-md px-3 py-2 w-full"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email (opcional)"
            className="border rounded-md px-3 py-2 w-full"
          />
          <button
            onClick={startSession}
            className="bg-primary text-primary-foreground rounded-md py-2 mt-2"
          >
            Iniciar conversa
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && (
              <div className="text-muted-foreground text-center text-xs">
                Olá! Como podemos ajudar?
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.direction === "inbound" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`rounded-2xl px-3 py-2 max-w-[80%] ${m.direction === "inbound" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  {m.body}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="border-t p-2 flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Digite sua mensagem…"
              className="flex-1 border rounded-md px-3 py-2 resize-none max-h-32"
            />
            <button
              onClick={send}
              className="bg-primary text-primary-foreground rounded-md px-3 py-2"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
