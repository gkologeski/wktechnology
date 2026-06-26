// Sourcing — overview hub. Onda 5 / Slice 2.
import { createFileRoute, Link } from "@tanstack/react-router";
import { Users2, Mail, Gift, ArrowRight } from "lucide-react";
import { AtsPageHeader } from "@/components/ats/ui";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/(ats)/sourcing/")({
  component: SourcingHub,
});

const TILES = [
  {
    to: "/sourcing/pools",
    icon: Users2,
    title: "Talent Pools",
    description: "Listas estáticas e smart com candidatos do seu banco de talentos.",
  },
  {
    to: "/sourcing/sequences",
    icon: Mail,
    title: "Sequências",
    description: "Cadências multi-canal (email, WhatsApp, LinkedIn manual).",
  },
  {
    to: "/sourcing/referrals",
    icon: Gift,
    title: "Indicações",
    description: "Programa de referrals com tracking de bônus.",
  },
] as const;

function SourcingHub() {
  return (
    <div className="flex flex-col gap-6 pb-10">
      <AtsPageHeader
        eyebrow="ATS · Sourcing"
        title="Sourcing & Talent CRM"
        description="Construa relacionamento contínuo com candidatos — antes da vaga existir."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <Link key={t.to} to={t.to} className="group">
            <Card className="h-full transition-colors group-hover:border-primary/40">
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <t.icon className="h-4 w-4" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold tracking-tight">{t.title}</h3>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
