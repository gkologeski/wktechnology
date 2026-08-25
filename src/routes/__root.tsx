import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";
import { Toaster } from "@/components/ui/sonner";

import { supabase } from "@/integrations/supabase/client";
import { I18nProvider } from "@/lib/i18n";
import { BrandingProvider } from "@/lib/branding";
import { NewVersionWatcher } from "@/components/new-version-watcher";
import { installChunkReloadGuard } from "@/lib/chunk-reload";
import { AgentTrigger } from "@/components/ai-agent/agent-trigger";

if (typeof window !== "undefined") {
  installChunkReloadGuard();
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-4 text-muted-foreground">Página não encontrada.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Ir para o início
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "WK Technology CRM — Gestão de Leads e Vendas" },
      {
        name: "description",
        content:
          "Plataforma de CRM para gerenciar leads, contatos, empresas e pipelines de vendas com eficiência. Acesso restrito por convite.",
      },
      { property: "og:title", content: "WK Technology CRM — Gestão de Leads e Vendas" },
      { name: "twitter:title", content: "WK Technology CRM — Gestão de Leads e Vendas" },
      {
        property: "og:description",
        content:
          "Plataforma de CRM para gerenciar leads, contatos, empresas e pipelines de vendas com eficiência.",
      },
      {
        name: "twitter:description",
        content:
          "Plataforma de CRM para gerenciar leads, contatos, empresas e pipelines de vendas com eficiência.",
      },
      { property: "og:site_name", content: "WK Technology CRM" },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/PB4PktIUasgn421PW6R6A77d5kJ3/social-images/social-1778901422473-Logo_WK.webp",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/PB4PktIUasgn421PW6R6A77d5kJ3/social-images/social-1778901422473-Logo_WK.webp",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { name: "google-site-verification", content: "eo4O2nHO7ieY5V_2kyIbYY8CAy7TTCNWIrUMu3ADSt4" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest", crossOrigin: "use-credentials" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "WK Technology CRM",
              url: "https://app.wktechnology.com.br",
              logo: "https://storage.googleapis.com/gpt-engineer-file-uploads/PB4PktIUasgn421PW6R6A77d5kJ3/social-images/social-1778901422473-Logo_WK.webp",
            },
            {
              "@type": "WebSite",
              name: "WK Technology CRM",
              url: "https://app.wktechnology.com.br",
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthInvalidator() {
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // Só invalida quando o usuário troca; ignora INITIAL_SESSION e TOKEN_REFRESHED
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
        qc.invalidateQueries();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, qc]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthInvalidator />
        <NewVersionWatcher />
        <I18nProvider>
          <BrandingProvider>
            <main id="main-content">
              <Outlet />
            </main>
            <AgentTrigger />
            <ConfirmDialogHost />
            <Toaster richColors position="top-right" />
          </BrandingProvider>
        </I18nProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
