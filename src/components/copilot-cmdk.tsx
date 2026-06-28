import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import { askCopilot } from "@/lib/copilot.functions";

type Source = { kind: string; id: string; title: string; snippet: string; url?: string };

export function CopilotCmdK() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string>("");
  const [sources, setSources] = useState<Source[]>([]);
  const ask = useServerFn(askCopilot);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("copilot:open", onOpen as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("copilot:open", onOpen as EventListener);
    };
  }, []);

  async function submit() {
    if (!q.trim()) return;
    setLoading(true);
    setAnswer("");
    setSources([]);
    try {
      const r = await ask({ data: { question: q } });
      setAnswer(r.answer);
      setSources(r.sources);
    } catch (e) {
      setAnswer(e instanceof Error ? e.message : "Erro ao consultar copilot.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4" /> Copilot · pergunte sobre seus dados
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(new CustomEvent("ats:associate-open"));
              }}
              className="text-xs text-primary hover:underline"
            >
              Associar candidato a vaga
            </button>
          </div>
          <div className="flex gap-2">
            <Input
              autoFocus
              placeholder='Ex.: "negócios prestes a fechar com a Acme"'
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
            <Button onClick={submit} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
            </Button>
          </div>
          {answer && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
              {answer}
            </div>
          )}
          {sources.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Fontes</div>
              <ul className="space-y-1">
                {sources.map((s, i) => (
                  <li key={`${s.kind}-${s.id}`} className="text-xs flex gap-2">
                    <span className="text-muted-foreground">[{i + 1}]</span>
                    {s.url ? (
                      <Link
                        to={s.url}
                        onClick={() => setOpen(false)}
                        className="text-primary hover:underline"
                      >
                        {s.title}
                      </Link>
                    ) : (
                      <span>{s.title}</span>
                    )}
                    <span className="text-muted-foreground truncate">— {s.snippet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="text-[10px] text-muted-foreground">Atalho: Cmd/Ctrl + K</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
