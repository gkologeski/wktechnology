// Página pública /accept-invite — usuário convidado define senha e completa perfil.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { completeInviteProfile } from "@/lib/teams.functions";

export const Route = createFileRoute("/accept-invite")({
  component: AcceptInvitePage,
  head: () => ({
    meta: [
      { title: "Aceitar convite — WK Technology CRM" },
      { name: "description", content: "Confirme seus dados e crie uma senha para acessar o workspace do WK Technology CRM." },
      { property: "og:title", content: "Aceitar convite — WK Technology CRM" },
      { property: "og:description", content: "Conclua seu acesso ao workspace do WK Technology CRM." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AcceptInvitePage() {
  const navigate = useNavigate();
  const completeFn = useServerFn(completeInviteProfile);

  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash || "";
    const hasInviteHash = hash.includes("type=invite") || hash.includes("type=signup") || hash.includes("type=recovery");

    const hydrate = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const meta = (data.user.user_metadata ?? {}) as { full_name?: string; phone?: string };
        setFullName(meta.full_name ?? "");
        setPhone(meta.phone ?? "");
        setReady(true);
      } else if (!hasInviteHash) {
        setInvalid(true);
      }
    };

    hydrate();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session?.user) {
        const meta = (session.user.user_metadata ?? {}) as { full_name?: string; phone?: string };
        setFullName((v) => v || (meta.full_name ?? ""));
        setPhone((v) => v || (meta.phone ?? ""));
        setReady(true);
        setInvalid(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const canSubmit =
    ready &&
    fullName.trim().length >= 2 &&
    phone.trim().length >= 8 &&
    password.length >= 6 &&
    password === confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
        data: { full_name: fullName.trim(), phone: phone.trim() },
      });
      if (error) throw new Error(error.message);
      await completeFn({ data: { full_name: fullName.trim(), phone: phone.trim() } });
      toast.success("Bem-vindo(a)!");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao concluir convite");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <h1 className="sr-only">Aceitar convite no WK Technology CRM</h1>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Aceitar convite</CardTitle>
          <CardDescription>
            Confirme seus dados e crie uma senha para acessar o workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invalid ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Convite inválido ou expirado. Peça ao administrador para enviar um novo convite.
              </p>
              <Link to="/login" className="text-primary hover:underline">Ir para o login</Link>
            </div>
          ) : !ready ? (
            <p className="text-sm text-muted-foreground">Validando convite…</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ai-name">Nome completo</Label>
                <Input id="ai-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-phone">Telefone celular</Label>
                <PhoneInput id="ai-phone" required value={phone} onChange={setPhone} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-pass">Nova senha</Label>
                <Input id="ai-pass" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-pass2">Confirme a senha</Label>
                <Input id="ai-pass2" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                {confirm && password !== confirm && (
                  <p className="text-xs text-destructive">As senhas não conferem.</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={submitting || !canSubmit}>
                {submitting ? "Salvando…" : "Acessar workspace"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
