// Hub de importações de dados — vive dentro de Configurações porque exige
// conhecimento de administrador (mapeamento de campos, credenciais, deduplicação).
import { Link } from "@tanstack/react-router";
import { ArrowRight, Building2, Database, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ImportSource = {
  slug: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "disponivel" | "em-breve";
};

const SOURCES: ImportSource[] = [
  {
    slug: "hubspot",
    name: "HubSpot",
    description:
      "Importa e sincroniza empresas, contatos, leads, negócios e proprietários a partir do HubSpot.",
    icon: RefreshCw,
    status: "disponivel",
  },
  {
    slug: "contaazul",
    name: "Conta Azul",
    description:
      "Importa contas a pagar, contas a receber, plano de contas e extratos bancários para o TechFinance.",
    icon: Building2,
    status: "disponivel",
  },
];

export function ImportHubPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Importar dados"
        description="Fontes de importação e sincronização do workspace. Configuração de administrador: revise o mapeamento de campos antes de executar uma importação."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {SOURCES.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.slug}
              to="/settings/integrations/$slug"
              params={{ slug: s.slug }}
              className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
              aria-label={`Configurar importação do ${s.name}`}
            >
              <Card className="h-full transition-colors group-hover:border-primary/40">
                <CardContent className="flex items-start gap-3 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium leading-tight truncate">{s.name}</h3>
                      <Badge variant={s.status === "disponivel" ? "default" : "secondary"}>
                        {s.status === "disponivel" ? "Disponível" : "Em breve"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <Database className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Precisa de outra fonte? Consulte o{" "}
            <Link to="/settings/marketplace" className="font-medium text-primary underline">
              Marketplace
            </Link>{" "}
            ou o catálogo de{" "}
            <Link to="/settings/integrations" className="font-medium text-primary underline">
              Integrações
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
