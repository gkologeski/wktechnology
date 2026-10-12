import { Link } from "@tanstack/react-router";
import { ArrowRight, Bot, MessageCircle, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/techhire/ui";

const KINDS = [
  {
    icon: PhoneCall,
    title: "Ligações por voz",
    description:
      "Campanhas de discagem com o agente de voz: público, janela, tentativas e responsável.",
    to: "/prospecting/campaigns",
    cta: "Abrir campanhas de voz",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp com template aprovado",
    description:
      "Disparo do modelo inicial aprovado, com limites de envio. Opcionalmente entrega as respostas a um agente SDR escolhido na campanha.",
    to: "/campaigns/whatsapp",
    cta: "Abrir campanhas de WhatsApp",
  },
  {
    icon: Bot,
    title: "Agentes SDR",
    description:
      "Persona, playbook e supervisão das conversas ficam em Agentes. A campanha só escolhe qual agente responde.",
    to: "/agents/sdr",
    cta: "Abrir Agentes",
  },
] as const;

/** Entrada única para os tipos de campanha que realmente funcionam hoje. */
export function CampaignsHub() {
  return (
    <section className="space-y-3">
      <SectionHeader
        title="Tipos de campanha"
        description="Campanha define público, abordagem, cadência e limites. Cadências multicanal e roteiros ficam nas seções abaixo."
      />
      <div className="grid gap-3 md:grid-cols-3">
        {KINDS.map((k) => (
          <article
            key={k.to}
            className="flex flex-col gap-3 rounded-lg border border-border-default bg-surface-1 p-4"
          >
            <div className="flex items-center gap-2">
              <k.icon className="h-4 w-4 text-primary" aria-hidden />
              <h3 className="text-sm font-semibold">{k.title}</h3>
            </div>
            <p className="flex-1 text-xs text-muted-foreground">{k.description}</p>
            <Button asChild variant="outline" size="sm" className="self-start">
              <Link to={k.to}>
                {k.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
