// /home — ERP Home: agrega módulos contratados e configurações do workspace.
// Presentational + read-only. Usa server functions existentes; nenhuma
// alteração em RLS, schema ou lógica de negócio.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Briefcase,
  Users,
  Boxes,
  Building2,
  UsersRound,
  ShieldCheck,
  CreditCard,
  Palette,
  KeyRound,
  Languages,
  Webhook,
  ScrollText,
  Puzzle,
  Store,
  FileDown,
  FileUp,
  Globe,
  Bell,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import {
  listWorkspaceModules,
  type WorkspaceModuleRow,
} from "@/lib/workspace/modules.functions";
import { buildModuleUrl, isCrossHostUrl } from "@/lib/hosts";
import type { ModuleId } from "@/lib/modules/registry";
import {
  PageHeader,
  SectionHeader,
  MetricCard,
  StatusBadge,
} from "@/components/techhire/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/home")({
  component: ErpHome,
});

// ---------------------------------------------------------------------------
// Módulos
// ---------------------------------------------------------------------------

const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  briefcase: Briefcase,
  users: Users,
};

function openModule(moduleId: ModuleId) {
  const url = buildModuleUrl(moduleId, "/");
  if (isCrossHostUrl(url)) {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    window.location.assign(url);
  }
}

function ModulesGrid() {
  const listFn = useServerFn(listWorkspaceModules);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["home-workspace-modules"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Não foi possível carregar os módulos agora.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((m: WorkspaceModuleRow) => {
        const Icon = MODULE_ICONS[m.icon ?? ""] ?? Boxes;
        const product = m.default_product_name ?? m.name;
        const isModuleId = (m.id === "crm" || m.id === "ats");
        const status: "Ativo" | "Disponível" | "Não contratado" = m.enabled
          ? "Ativo"
          : m.is_contracted
          ? "Disponível"
          : "Não contratado";
        const canEnter = m.enabled && isModuleId;
        return (
          <Card
            key={m.id}
            className={cn(
              "h-full flex flex-col transition-all",
              canEnter && "hover:border-primary/40 hover:shadow-sm",
            )}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="size-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <span
                  className={cn(
                    "text-[11px] font-medium rounded-full px-2 py-0.5",
                    status === "Ativo" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                    status === "Disponível" && "bg-muted text-muted-foreground",
                    status === "Não contratado" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                  )}
                >
                  {status}
                </span>
              </div>
              <CardTitle className="text-base mt-3">{product}</CardTitle>
              <CardDescription className="text-xs">{m.name}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto flex items-center justify-between pt-0">
              <div className="text-xs text-muted-foreground">
                {m.plan_code ? `Plano ${m.plan_code}` : "Sem plano ativo"}
              </div>
              {canEnter ? (
                <Button size="sm" onClick={() => openModule(m.id as ModuleId)}>
                  Entrar
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" variant="outline" asChild>
                  <Link to="/workspace/modules">Configurar</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Marketplace / explorar mais */}
      <Card className="border-dashed h-full flex flex-col">
        <CardHeader>
          <div className="size-10 rounded-md bg-muted flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
          </div>
          <CardTitle className="text-base mt-3">Explorar mais</CardTitle>
          <CardDescription className="text-xs">
            Descubra add-ons e novos módulos no marketplace.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-auto pt-0">
          <Button size="sm" variant="outline" asChild>
            <Link to="/marketplace">Abrir marketplace</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Configurações do workspace
// ---------------------------------------------------------------------------

type SettingItem = {
  to: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
};

type SettingGroup = {
  title: string;
  description: string;
  items: SettingItem[];
};

const SETTING_GROUPS: SettingGroup[] = [
  {
    title: "Pessoas",
    description: "Membros, times e convites do workspace.",
    items: [
      { to: "/settings/workspace-team", title: "Membros", desc: "Convites e acessos.", icon: UsersRound },
      { to: "/settings/teams", title: "Times", desc: "Grupos operacionais.", icon: Users },
      { to: "/settings/roles", title: "Papéis e permissões", desc: "Admin, gestor, membro.", icon: ShieldCheck },
    ],
  },
  {
    title: "Faturamento",
    description: "Assinatura, uso e pagamento.",
    items: [
      { to: "/settings/billing", title: "Plano & cobrança", desc: "Assinatura e faturas.", icon: CreditCard },
      { to: "/invoices", title: "Faturas", desc: "Histórico de pagamentos.", icon: FileDown },
      { to: "/workspace/modules", title: "Módulos contratados", desc: "Ative ou desative módulos.", icon: Boxes },
    ],
  },
  {
    title: "Identidade",
    description: "Marca, idioma e residência.",
    items: [
      { to: "/settings/branding", title: "Branding", desc: "Logo, cores e identidade.", icon: Palette },
      { to: "/settings/language", title: "Idioma & região", desc: "Idioma, fuso e moeda.", icon: Languages },
      { to: "/settings/data-residency", title: "Residência de dados", desc: "Localização de armazenamento.", icon: Globe },
    ],
  },
  {
    title: "Segurança & auditoria",
    description: "Chaves, políticas e histórico.",
    items: [
      { to: "/settings/api-keys", title: "API Keys", desc: "Tokens para integração.", icon: KeyRound },
      { to: "/settings/security", title: "Segurança", desc: "Políticas e SSO/SAML.", icon: ShieldCheck },
      { to: "/settings/audit-log", title: "Audit log", desc: "Ações administrativas.", icon: ScrollText },
      { to: "/settings/webhooks", title: "Webhooks", desc: "Eventos para sistemas externos.", icon: Webhook },
    ],
  },
  {
    title: "Integrações",
    description: "Conectores e extensões.",
    items: [
      { to: "/integrations", title: "Integrações", desc: "Conectores nativos.", icon: Puzzle },
      { to: "/marketplace", title: "Marketplace", desc: "Extensões e add-ons.", icon: Store },
      { to: "/settings/notifications", title: "Notificações", desc: "E-mail, Slack, in-app.", icon: Bell },
    ],
  },
  {
    title: "Dados",
    description: "Importação, exportação e privacidade.",
    items: [
      { to: "/settings/import-csv", title: "Importar", desc: "CSV, HubSpot e outros.", icon: FileUp },
      { to: "/settings/exports", title: "Exportar", desc: "Extraia dados do workspace.", icon: FileDown },
      { to: "/settings/privacy", title: "Privacidade & LGPD", desc: "Titulares e consentimento.", icon: ShieldCheck },
    ],
  },
];

function SettingsGrid() {
  return (
    <div className="space-y-8">
      {SETTING_GROUPS.map((group) => (
        <section key={group.title} className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">{group.title}</h3>
            <p className="text-xs text-muted-foreground">{group.description}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to + item.title}
                  to={item.to}
                  aria-label={item.title}
                  className="group rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start gap-3">
                    <div className="size-8 shrink-0 rounded-md bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{item.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{item.desc}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

function ErpHome() {
  const listFn = useServerFn(listWorkspaceModules);
  const { data: modules } = useQuery({
    queryKey: ["home-workspace-modules"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  const activeCount = modules?.filter((m) => m.enabled).length ?? 0;
  const contractedCount = modules?.filter((m) => m.is_contracted).length ?? 0;

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Bem-vindo ao seu ERP"
        description="Acesse seus módulos e gerencie as configurações comuns a todo o workspace."
        primaryAction={
          <Button asChild>
            <Link to="/workspace/modules">
              <Boxes className="mr-2 h-4 w-4" />
              Gerenciar módulos
            </Link>
          </Button>
        }
        secondaryActions={
          <Button variant="outline" asChild>
            <Link to="/settings">
              Todas as configurações
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Módulos ativos"
          value={String(activeCount)}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <MetricCard
          label="Módulos contratados"
          value={String(contractedCount)}
          icon={<Boxes className="h-4 w-4" />}
        />
        <MetricCard
          label="Status"
          value="Operacional"
          icon={<Building2 className="h-4 w-4" />}
        />
      </div>

      <section className="space-y-4">
        <SectionHeader
          title="Módulos"
          description="Entre em um módulo contratado ou explore novos."
        />
        <ModulesGrid />
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Configurações do workspace"
          description="Ajustes comuns a todos os módulos do ERP."
        />
        <SettingsGrid />
      </section>

      <div className="text-xs text-muted-foreground pt-6 border-t">
        <StatusBadge status="active">Workspace</StatusBadge>
        <span className="ml-2">
          As configurações acima se aplicam a todos os módulos do ERP.
        </span>
      </div>
    </div>
  );
}
