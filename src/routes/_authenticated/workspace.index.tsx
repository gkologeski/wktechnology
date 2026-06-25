// /workspace — Workspace Hub: ponto central neutro (não-modular) com cards
// para Membros, Papéis, Billing, Módulos, Branding, API Keys e Idioma.
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  UsersRound,
  ShieldCheck,
  CreditCard,
  Boxes,
  Palette,
  KeyRound,
  Languages,
  Building2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/workspace/")({
  component: WorkspaceHub,
});

type HubCard = {
  to: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  status?: string;
};

const CARDS: HubCard[] = [
  {
    to: "/settings/workspace-team",
    title: "Membros",
    desc: "Convide usuários e gerencie quem participa do workspace.",
    icon: UsersRound,
  },
  {
    to: "/settings/workspace-team",
    title: "Papéis e Permissões",
    desc: "Atribua admin, gestor ou membro a cada usuário.",
    icon: ShieldCheck,
  },
  {
    to: "/settings/billing",
    title: "Planos & Cobrança",
    desc: "Assinatura, uso, faturas e método de pagamento.",
    icon: CreditCard,
  },
  {
    to: "/workspace/modules",
    title: "Módulos contratados",
    desc: "Ative ou desative TechSales (CRM), TechHire (ATS) e add-ons.",
    icon: Boxes,
  },
  {
    to: "/settings/branding",
    title: "Branding",
    desc: "Logo, cores e identidade visual do workspace.",
    icon: Palette,
    status: "Em breve",
  },
  {
    to: "/settings/api-keys",
    title: "API Keys",
    desc: "Tokens para integração programática.",
    icon: KeyRound,
    status: "Em breve",
  },
  {
    to: "/settings/locale",
    title: "Idioma & Região",
    desc: "Preferências de idioma, fuso horário e moeda.",
    icon: Languages,
    status: "Em breve",
  },
];

function WorkspaceHub() {
  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
          <p className="text-sm text-muted-foreground">
            Configurações do seu workspace — comuns a todos os módulos contratados.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((c) => {
          const Icon = c.icon;
          const isComing = !!c.status;
          const inner = (
            <Card
              className={
                "h-full transition-shadow " +
                (isComing ? "opacity-70" : "hover:shadow-md cursor-pointer")
              }
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="size-9 rounded-md bg-muted flex items-center justify-center">
                    <Icon className="h-4 w-4" />
                  </div>
                  {c.status ? (
                    <span className="text-xs rounded-full bg-muted px-2 py-0.5">
                      {c.status}
                    </span>
                  ) : null}
                </div>
                <CardTitle className="text-base mt-2">{c.title}</CardTitle>
                <CardDescription className="text-xs">{c.desc}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          );
          if (isComing) return <div key={c.title}>{inner}</div>;
          return (
            <Link key={c.title} to={c.to}>
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
