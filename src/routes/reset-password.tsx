import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailInput } from "@/components/ui/email-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Recuperar senha — WK Technology CRM" },
      {
        name: "description",
        content: "Solicite a redefinição de senha da sua conta no WK Technology CRM.",
      },
      { property: "og:title", content: "Recuperar senha — WK Technology CRM" },
      { property: "og:description", content: "Solicite a redefinição de senha da sua conta." },
      { property: "og:url", content: "https://crm.wktechnology.com.br/reset-password" },
    ],
    links: [{ rel: "canonical", href: "https://crm.wktechnology.com.br/reset-password" }],
  }),
});

function ResetPasswordPage() {
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash.includes("type=recovery")) setRecoveryMode(true);
    const { data: sub } = supabase.auth.onAuthStateChange((evt) => {
      if (evt === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const sendEmail = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else toast.success("Email enviado. Verifique sua caixa de entrada.");
  };

  const updatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Senha atualizada!");
      window.location.href = "/dashboard";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <h1 className="sr-only">Recuperar senha do WK Technology CRM</h1>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{recoveryMode ? "Nova senha" : "Recuperar senha"}</CardTitle>
          <CardDescription>
            {recoveryMode
              ? "Defina uma nova senha para sua conta."
              : "Enviaremos um link para você redefinir."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recoveryMode ? (
            <form onSubmit={updatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                Atualizar senha
              </Button>
            </form>
          ) : (
            <form onSubmit={sendEmail} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <EmailInput id="email" required value={email} onChange={setEmail} />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                Enviar link
              </Button>
              <div className="text-sm text-muted-foreground text-center">
                <Link to="/login" className="text-primary hover:underline">
                  Voltar para o login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
