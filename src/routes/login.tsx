import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailInput } from "@/components/ui/email-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

function safeNext(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "";
}

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (s: Record<string, unknown>) => ({ next: safeNext(s.next) }),
  head: () => ({
    meta: [
      { title: "Entrar — WK Technology CRM" },
      {
        name: "description",
        content: "Acesse sua conta no WK Technology CRM para gerenciar leads, contatos e negócios.",
      },
      { property: "og:title", content: "Entrar — WK Technology CRM" },
      { property: "og:description", content: "Acesse sua conta no WK Technology CRM." },
      { property: "og:url", content: "https://ats.wktechnology.com.br/login" },
    ],
    links: [{ rel: "canonical", href: "https://ats.wktechnology.com.br/login" }],
  }),
});

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const goAfterAuth = () => {
    if (next) window.location.href = next;
    else navigate({ to: "/dashboard" });
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) goAfterAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, navigate, next]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else goAfterAuth();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <h1 className="mb-8 text-5xl md:text-6xl font-bold tracking-tight text-foreground text-center">
        Acesse sua conta no <span className="text-primary">WK Technology CRM</span>
      </h1>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Entrar no CRM</CardTitle>
          <CardDescription>
            Acesse sua conta para gerenciar seus leads, contatos e negócios.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={async () => {
              const r = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: next
                  ? `${window.location.origin}/login?next=${encodeURIComponent(next)}`
                  : window.location.origin,
              });
              if (r.error) toast.error(r.error.message);
              else if (!r.redirected) goAfterAuth();
            }}
          >
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
              />
            </svg>
            Entrar com Google
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <EmailInput id="email" required value={email} onChange={setEmail} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Entrando..." : "Entrar"}
            </Button>
            <div className="text-sm text-muted-foreground text-center space-y-1">
              <div>
                <Link to="/reset-password" className="text-primary hover:underline">
                  Esqueci minha senha
                </Link>
              </div>
              <div className="text-xs">
                O acesso é por convite. Solicite a um administrador do workspace.
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="mt-4 text-xs text-muted-foreground flex gap-4">
        <Link to="/privacy" className="hover:underline">
          Política de Privacidade
        </Link>
        <Link to="/terms" className="hover:underline">
          Termos de Serviço
        </Link>
      </div>
    </div>
  );
}
