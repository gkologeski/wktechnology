// Página pública /accept-invite/$token — convidado define senha e entra no workspace.
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
import { lookupInviteByToken, consumeInvite } from "@/lib/workspace-invites.functions";

export const Route = createFileRoute("/accept-invite/$token")({
  component: AcceptInviteTokenPage,
  head: () => ({
    meta: [
      { title: "Aceitar convite — WK Technology CRM" },
      {
        name: "description",
        content:
          "Conclua seu cadastro no workspace do WK Technology CRM utilizando o convite recebido.",
      },
      { property: "og:title", content: "Aceitar convite — WK Technology CRM" },
      {
        property: "og:description",
        content: "Conclua seu cadastro no workspace do WK Technology CRM.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type InviteInfo = {
  valid: true;
  email: string;
  role: "admin" | "manager" | "member";
  workspace: { id: string; name: string; slug: string };
  branding?: {
    brand_name: string | null;
    logo_url: string | null;
    primary_color: string | null;
  };
  product_name?: string;
  user_exists: boolean;
};

function AcceptInviteTokenPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const lookupFn = useServerFn(lookupInviteByToken);
  const consumeFn = useServerFn(consumeInvite);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<InviteInfo | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await lookupFn({ data: { token } });
        if (cancelled) return;
        if (!res.valid) {
          setError(
            res.reason === "expired"
              ? "Convite expirado."
              : res.reason === "accepted"
                ? "Convite já utilizado."
                : "Convite inválido.",
          );
        } else {
          setInfo(res as InviteInfo);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao validar convite.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, lookupFn]);

  const canSubmit =
    !!info &&
    fullName.trim().length >= 2 &&
    phone.trim().length >= 8 &&
    password.length >= 8 &&
    password === confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !info) return;
    setSubmitting(true);
    try {
      await consumeFn({
        data: {
          token,
          password,
          full_name: fullName.trim(),
          phone: phone.trim(),
        },
      });
      // Faz login com a senha definida
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: info.email,
        password,
      });
      if (signErr) throw new Error(signErr.message);
      toast.success(`Bem-vindo(a) ao workspace ${info.workspace.name}!`);
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao aceitar convite");
    } finally {
      setSubmitting(false);
    }
  };

  const brandName = info?.branding?.brand_name || info?.workspace?.name || "";
  const logoUrl = info?.branding?.logo_url || null;
  const primary = info?.branding?.primary_color || null;
  const productName = info?.product_name || "TechERP";
  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    manager: "Gestor",
    member: "Membro",
  };
  const roleLabel = info ? (roleLabels[info.role] ?? info.role) : "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <h1 className="sr-only">Aceitar convite</h1>
      <Card className="w-full max-w-md">
        <CardHeader>
          {logoUrl && (
            <img
              src={logoUrl}
              alt={brandName}
              className="h-9 w-auto mb-3"
              style={{ maxHeight: 36 }}
            />
          )}
          <CardTitle>{brandName ? `Aceitar convite — ${brandName}` : "Aceitar convite"}</CardTitle>
          <CardDescription>
            {loading ? (
              "Validando convite…"
            ) : info ? (
              <>
                Você foi convidado para o workspace <strong>{brandName}</strong> do{" "}
                <strong>{productName}</strong> como <strong>{roleLabel}</strong>.
              </>
            ) : (
              "Convite indisponível."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : error || !info ? (
            <div className="space-y-3 text-sm">
              <p className="text-destructive">{error ?? "Convite inválido."}</p>
              <Link to="/login" className="text-primary hover:underline">
                Ir para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={info.email} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ait-name">Nome completo</Label>
                <Input
                  id="ait-name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ait-phone">Telefone celular</Label>
                <PhoneInput id="ait-phone" required value={phone} onChange={setPhone} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ait-pass">
                  {info.user_exists ? "Defina/atualize sua senha" : "Crie uma senha"}
                </Label>
                <PasswordInput
                  id="ait-pass"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Use no mínimo 8 caracteres. Recomendamos combinar letras maiúsculas, minúsculas,
                  números e símbolos.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ait-pass2">Confirme a senha</Label>
                <PasswordInput
                  id="ait-pass2"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                {confirm && password !== confirm && (
                  <p className="text-xs text-destructive">As senhas não conferem.</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={submitting || !canSubmit}
                style={primary ? { backgroundColor: primary, borderColor: primary } : undefined}
              >
                {submitting ? "Entrando…" : "Acessar workspace"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
