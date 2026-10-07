import { useState } from "react";
import { toast } from "sonner";
import { ChevronRight, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Topbar } from "./frame";

export function CustomerRecord() {
  const [tab, setTab] = useState("Contato");
  const [detail, setDetail] = useState(0);
  return (
    <>
      <Topbar title="Cliente Exemplo" subtitle="Empresa Aurora · dados fictícios">
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast.success("Contexto revisado neste protótipo")}
        >
          Revisar contexto
        </Button>
      </Topbar>
      <nav className="ap-tabs">
        {["Lead", "Contato", "Empresa", "Negócio", "Projeto"].map((t) => (
          <Button
            key={t}
            variant="ghost"
            className={`my-2 text-xs ${tab === t ? "bg-accent text-primary" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </nav>
      <div className="ap-record">
        <aside className="ap-master">
          <span className="flex size-12 items-center justify-center rounded-md bg-accent text-primary">
            <UserRound size={24} />
          </span>
          <h2 className="mt-4 text-lg font-semibold">Cliente Exemplo</h2>
          <p className="mt-2 text-xs text-muted-foreground">{tab} · contexto vinculado</p>
          <dl className="mt-8 space-y-5 text-xs">
            <div>
              <dt className="text-muted-foreground">Negócio</dt>
              <dd className="mt-1">Equipe de desenvolvimento</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Projeto</dt>
              <dd className="mt-1">Aurora · demonstração</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Responsável</dt>
              <dd className="mt-1">Equipe Comercial</dd>
            </div>
          </dl>
        </aside>
        <section className="ap-timeline">
          <h3 className="mb-8 text-sm font-semibold">Histórico de conversas</h3>
          {[
            ["Hoje · 10:42", "Agente Técnico", "Dúvida de integração encaminhada ao P.O."],
            [
              "Hoje · 10:36",
              "Equipe Comercial → Agente Técnico",
              "Troca feita pela equipe. Contexto do projeto preservado.",
            ],
            [
              "Ontem · 16:20",
              "Agente Vendas",
              "Necessidade identificada: 2 Sênior, 3 Pleno, duração de 2 anos.",
            ],
          ].map(([time, author, text], i) => (
            <div key={time} className="ap-timeline-item">
              <p className="text-[10px] text-muted-foreground">{time}</p>
              <p className="mt-2 text-sm font-semibold">{author}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p>
              <Button
                size="sm"
                variant="link"
                className="mt-2 h-auto p-0 text-xs"
                onClick={() => setDetail(i)}
              >
                Ver conversa
                <ChevronRight />
              </Button>
            </div>
          ))}
        </section>
        <aside className="ap-activity">
          <p className="ap-caption uppercase">Conversa selecionada</p>
          <h3 className="mt-3 text-sm font-semibold">
            {detail === 2 ? "Agente Vendas" : "Agente Técnico"}
          </h3>
          <div className="mt-6 space-y-5 text-xs leading-relaxed">
            <p className="rounded-md bg-product-panel p-4">
              {detail === 2
                ? "Precisamos dimensionar uma equipe por dois anos."
                : "Como funciona a integração no projeto?"}
            </p>
            <p>
              Vou reunir o contexto para {detail === 2 ? "a equipe comercial" : "o P.O."}, mantendo
              o histórico nesta conversa.
            </p>
          </div>
          <div className="mt-8 border-t border-border-subtle pt-4 text-[10px] text-muted-foreground">
            Autoria: equipe responsável
            <br />
            Origem: receptivo · demonstração
          </div>
        </aside>
      </div>
    </>
  );
}
