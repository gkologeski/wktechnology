import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Check, Zap, Shield, Users, BarChart3, MessageSquare, FileText, Workflow } from "lucide-react";

export const Route = createFileRoute("/sales")({
  head: () => ({
    meta: [
      { title: "WK Technology CRM — Vendas, atendimento e cobrança em um só lugar" },
      { name: "description", content: "Plataforma all-in-one para PMEs brasileiras: CRM, WhatsApp, faturamento, NFS-e, propostas, automações e portal do cliente. Teste grátis." },
      { property: "og:title", content: "WK Technology CRM — Tudo da operação comercial em um só lugar" },
      { property: "og:description", content: "CRM, WhatsApp, faturamento, NFS-e e automações para PMEs brasileiras. Comece grátis e cresça quando precisar." },
      { property: "og:url", content: "https://crm.wktechnology.com.br/sales" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "WK Technology CRM" },
      { name: "twitter:description", content: "CRM completo para PMEs brasileiras." },
    ],
    links: [{ rel: "canonical", href: "https://crm.wktechnology.com.br/sales" }],
  }),
  component: SalesPage,
});

const features = [
  { icon: Users, title: "CRM completo", desc: "Leads, contatos, empresas, negócios e pipeline visual." },
  { icon: MessageSquare, title: "Omnichannel", desc: "WhatsApp Business, e-mail e chat unificados na mesma caixa." },
  { icon: FileText, title: "Cotações e NFS-e", desc: "Propostas, assinatura eletrônica, faturamento e emissão automática." },
  { icon: Workflow, title: "Automações", desc: "Sequências, scoring, rotinas e workflows visuais." },
  { icon: BarChart3, title: "Dashboards", desc: "Indicadores em tempo real, metas e relatórios customizáveis." },
  { icon: Shield, title: "LGPD-ready", desc: "Exportação e exclusão pelo titular, RLS por workspace, auditoria." },
];

const plans = [
  {
    name: "Free",
    price: "R$ 0",
    cadence: "/mês",
    desc: "Para times pequenos começando a organizar a operação.",
    items: ["Até 3 usuários", "1.000 contatos", "Pipeline e tarefas", "WhatsApp básico"],
    cta: "Começar grátis",
    to: "/signup" as const,
  },
  {
    name: "Pro",
    price: "R$ 149",
    cadence: "/usuário/mês",
    desc: "Para times de vendas estruturados.",
    items: ["Usuários ilimitados", "Automações e sequências", "Cotações e contratos", "Faturamento e cobrança", "Integrações (Google, Meta, Twilio)"],
    cta: "Assinar Pro",
    highlight: true,
    to: "/signup" as const,
  },
  {
    name: "Business",
    price: "Sob consulta",
    cadence: "",
    desc: "Para empresas com requisitos avançados.",
    items: ["SSO/SAML e SCIM", "Auditoria avançada e DPA", "Limites elevados", "Onboarding dedicado", "SLA 99,9%"],
    cta: "Falar com vendas",
    to: "/signup" as const,
  },
];

function SalesPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/sales" className="font-bold text-lg">WK Technology CRM</Link>
          <nav className="flex items-center gap-4 text-sm">
            <a href="#features" className="hover:underline">Recursos</a>
            <a href="#pricing" className="hover:underline">Preços</a>
            <Link to="/login" className="hover:underline">Entrar</Link>
            <Button asChild size="sm"><Link to="/signup">Começar grátis</Link></Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-4xl text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Toda a operação comercial em um só lugar
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            CRM, WhatsApp, propostas, NFS-e e automações para PMEs brasileiras.
            Comece grátis e escale quando precisar — sem migrar de ferramenta.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button asChild size="lg"><Link to="/signup">Criar conta grátis</Link></Button>
            <Button asChild size="lg" variant="outline"><a href="#pricing">Ver planos</a></Button>
          </div>
          <p className="text-xs text-muted-foreground">Sem cartão de crédito. 7 dias para se arrepender.</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t bg-muted/30 px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Tudo que sua equipe precisa</h2>
            <p className="text-muted-foreground mt-2">Substitua 5 ferramentas por uma só.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title}>
                <CardHeader>
                  <f.icon className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">{f.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{f.desc}</CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Planos simples</h2>
            <p className="text-muted-foreground mt-2">Sem pegadinha, cancele quando quiser.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((p) => (
              <Card key={p.name} className={p.highlight ? "border-primary shadow-lg" : ""}>
                <CardHeader>
                  <CardTitle className="text-2xl">{p.name}</CardTitle>
                  <CardDescription>{p.desc}</CardDescription>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">{p.price}</span>
                    <span className="text-sm text-muted-foreground">{p.cadence}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {p.items.map((it) => (
                      <li key={it} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="w-full" variant={p.highlight ? "default" : "outline"}>
                    <Link to={p.to}>{p.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t px-4 py-20 bg-primary/5">
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <Zap className="h-10 w-10 text-primary mx-auto" />
          <h2 className="text-3xl font-bold">Pronto para acelerar suas vendas?</h2>
          <p className="text-muted-foreground">Crie sua conta em 2 minutos. Suporte humano em português.</p>
          <Button asChild size="lg"><Link to="/signup">Começar agora</Link></Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-8 text-sm text-muted-foreground">
        <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-4">
          <div>© {new Date().getFullYear()} WK Technology</div>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:underline">Termos</Link>
            <Link to="/privacy" className="hover:underline">Privacidade</Link>
            <Link to="/refund" className="hover:underline">Reembolso</Link>
            <Link to="/dpa" className="hover:underline">DPA</Link>
            <a href="mailto:contato@wktechnology.com.br" className="hover:underline">Contato</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
