import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Building2,
  CreditCard,
  Languages,
  ShieldCheck,
  KeyRound,
  Workflow,
  UsersRound,
  Palette,
  Plug,
  FileSearch,
  Globe2,
  GitBranch,
  ListChecks,
  Mail,
  Briefcase,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MODULES } from "@/lib/modules/registry";

export const Route = createFileRoute("/_authenticated/settings/")({
  component: SettingsIndex,
});

type Item = { title: string; description: string; url: string; icon: LucideIcon };
type Group = { label: string; description: string; items: Item[] };

const GROUPS: Group[] = [
  {
    label: "Workspace (ERP)",
    description:
      "Configurações compartilhadas entre todos os módulos do ERP — branding base, segurança, equipe, cobrança, integrações.",
    items: [
      { title: "Branding", description: "Marca, cores, logos e domínios", url: "/settings/branding", icon: Palette },
      { title: "Idioma", description: "Idioma padrão e overrides por usuário", url: "/settings/language", icon: Languages },
      { title: "Residência de dados", description: "Região de armazenamento", url: "/settings/data-residency", icon: Globe2 },
      { title: "Planos & Cobrança", description: "Assinaturas por módulo, faturas", url: "/settings/billing", icon: CreditCard },
      { title: "Equipe", description: "Membros do workspace", url: "/settings/teams", icon: UsersRound },
      { title: "Controle de Acesso", description: "Cargos, pacotes de permissão e regras de campo", url: "/home/access", icon: ShieldCheck },
      { title: "Segurança & SSO", description: "MFA, SSO/SAML, SCIM", url: "/settings/security", icon: ShieldCheck },
      { title: "API Keys", description: "Chaves de API por escopo", url: "/settings/api-keys", icon: KeyRound },
      { title: "Webhooks", description: "Notificações de eventos", url: "/settings/webhooks", icon: Plug },
      { title: "Integrações", description: "Conectores do marketplace", url: "/integrations", icon: Plug },
      { title: "Workflows", description: "Automação entre módulos", url: "/settings/workflows", icon: Workflow },
      { title: "Auditoria", description: "Log de eventos e exportação", url: "/settings/audit-log", icon: FileSearch },
    ],
  },
  {
    label: `${MODULES.crm.productName} — CRM`,
    description:
      "Configurações específicas da operação comercial: pipelines de vendas, fontes de leads, templates, dunning.",
    items: [
      { title: "Pipelines de vendas", description: "Stages, probabilidades", url: "/settings/pipelines", icon: GitBranch },
      { title: "Fontes de leads", description: "Origem dos leads", url: "/settings/lead-sources", icon: Users },
      { title: "Produtos & Catálogo", description: "Itens vendáveis", url: "/settings/products", icon: Briefcase },
      { title: "Cotações", description: "Templates e numeração", url: "/settings/quotes", icon: FileSearch },
      { title: "Templates de Email", description: "E-mails comerciais", url: "/settings/email-templates", icon: Mail },
      { title: "Sequências", description: "Cadências de outbound", url: "/settings/sequences", icon: ListChecks },
      { title: "Scoring", description: "Modelos de pontuação", url: "/settings/scoring", icon: ListChecks },
      { title: "Dunning", description: "Cobrança recorrente", url: "/settings/dunning", icon: CreditCard },
    ],
  },
  {
    label: `${MODULES.ats.productName} — ATS`,
    description:
      "Configurações de recrutamento e seleção: pipelines de candidatos, página de carreiras, scorecards.",
    items: [
      { title: "Pipelines de candidatos", description: "Stages do funil de R&S", url: "/settings/pipelines", icon: GitBranch },
      { title: "Página de Carreiras", description: "Site público de vagas", url: "/settings/portal", icon: Globe2 },
      { title: "Templates de e-mail (R&S)", description: "Comunicação com candidatos", url: "/settings/email-templates", icon: Mail },
      { title: "Macros e scripts", description: "Respostas rápidas", url: "/settings/macros", icon: ListChecks },
    ],
  },
];

function SettingsIndex() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => setFullName(data?.full_name ?? ""));
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", user.id);
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Perfil salvo");
  };

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Configurações do workspace e de cada módulo do ERP.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Building2 className="h-4 w-4" /> Meu perfil
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-1">
              <Label>Nome completo</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
          </div>
          <Button onClick={saveProfile} disabled={loading}>
            {loading ? "Salvando..." : "Salvar perfil"}
          </Button>
        </CardContent>
      </Card>

      {GROUPS.map((g) => (
        <section key={g.label} className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {g.label}
            </h2>
            <p className="text-xs text-muted-foreground">{g.description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((item) => (
              <Link
                key={item.url + item.title}
                to={item.url}
                className="block rounded-lg border p-3 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{item.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {item.description}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
