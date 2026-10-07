import { useState } from "react";
import {
  Bot,
  ArrowRight,
  Plus,
  Copy,
  Archive,
  FileText,
  MessageSquare,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/techhire/ui";
import { useDemo } from "./state";
import { type Agent } from "./model";

export function AgentActions({ agent }: { agent: Agent }) {
  const { duplicate, archive, select, go } = useDemo();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          select(agent.id);
          go("studio");
        }}
      >
        Abrir
        <ArrowRight />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Duplicar ${agent.name}`}
        title="Duplicar agente"
        onClick={() => duplicate(agent.id)}
      >
        <Copy />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Arquivar ${agent.name}`}
        title="Arquivar agente"
        onClick={() => setConfirm(true)}
      >
        <Archive />
      </Button>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogTitle>
            {agent.archived ? "Restaurar" : "Arquivar"} {agent.name}?
          </DialogTitle>
          <DialogDescription>Apenas o status demonstrativo será alterado.</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                archive(agent.id);
                setConfirm(false);
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AgentLibrary() {
  const { agents, create } = useDemo();
  const [query, setQuery] = useState("");
  const filtered = agents.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <section className="ap-editorial">
      <PageHeader
        title="Seus agentes"
        description="Uma missão, uma voz e um contexto para cada agente."
        primaryAction={
          <Button onClick={create}>
            <Plus />
            Novo agente
          </Button>
        }
      />
      <div className="my-7 flex items-center gap-3">
        <Search size={16} className="text-muted-foreground" />
        <Input
          aria-label="Buscar agentes"
          className="max-w-sm"
          placeholder="Buscar por nome…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="ap-caption">{filtered.length} agentes</span>
      </div>
      <div>
        {filtered.map((a, i) => (
          <article
            key={a.id}
            className="grid gap-4 border-t border-border-subtle py-6 lg:grid-cols-[minmax(0,1fr)_150px_150px]"
          >
            <div className="flex min-w-0 gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                {i === 1 ? (
                  <FileText size={20} />
                ) : i === 2 ? (
                  <MessageSquare size={20} />
                ) : (
                  <Bot size={20} />
                )}
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold">{a.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{a.purpose}</p>
                <p className="mt-3 text-[10px] text-muted-foreground">
                  {a.host} · {a.channel}
                </p>
              </div>
            </div>
            <div className="text-xs">
              <span
                className={`inline-flex items-center gap-1.5 ${a.archived ? "text-muted-foreground" : "text-success"}`}
              >
                <span className="size-1.5 rounded-full bg-current" />
                {a.archived ? "Arquivado" : "Homologação"}
              </span>
              <p className="mt-2 text-[10px] text-muted-foreground">v4 · rascunho local</p>
            </div>
            <AgentActions agent={a} />
          </article>
        ))}
        {!filtered.length && (
          <p className="py-8 text-sm text-muted-foreground">Nenhum agente encontrado.</p>
        )}
      </div>
    </section>
  );
}
