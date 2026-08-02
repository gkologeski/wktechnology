import { formatDateTime } from "@/lib/crm";
// Página /settings/security — 2FA (TOTP) + sessões.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert, LogOut, Trash2, RefreshCcw } from "lucide-react";
import { confirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/_authenticated/settings/security")({
  component: SecurityPage,
});

type Factor = {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: string;
  created_at: string;
};

function SecurityPage() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enroll, setEnroll] = useState<{ factorId: string; qr: string; secret: string } | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [session, setSession] = useState<{
    email?: string;
    provider?: string;
    signedInAt?: string;
  } | null>(null);

  const loadFactors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const all = [...(data.totp ?? []), ...(data.phone ?? [])] as Factor[];
      setFactors(all);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao listar fatores");
    } finally {
      setLoading(false);
    }
  };

  const loadSession = async () => {
    const { data } = await supabase.auth.getSession();
    const u = data.session?.user;
    setSession({
      email: u?.email ?? undefined,
      provider: (u?.app_metadata as { provider?: string } | undefined)?.provider,
      signedInAt: data.session?.user.last_sign_in_at ?? undefined,
    });
  };

  useEffect(() => {
    loadFactors();
    loadSession();
  }, []);

  const startEnroll = async () => {
    setCode("");
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `App ${new Date().toLocaleDateString("pt-BR")}`,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setEnroll({
      factorId: data.id,
      qr: data.totp.qr_code,
      secret: data.totp.secret,
    });
  };

  const verifyEnroll = async () => {
    if (!enroll || code.length < 6) return;
    setVerifying(true);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({
        factorId: enroll.factorId,
      });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: enroll.factorId,
        challengeId: ch.id,
        code,
      });
      if (vErr) throw vErr;
      toast.success("2FA ativado!");
      setEnroll(null);
      setCode("");
      await loadFactors();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Código inválido");
    } finally {
      setVerifying(false);
    }
  };

  const cancelEnroll = async () => {
    if (!enroll) return;
    try {
      await supabase.auth.mfa.unenroll({ factorId: enroll.factorId });
    } catch {
      /* ignore */
    }
    setEnroll(null);
    setCode("");
    await loadFactors();
  };

  const removeFactor = async (factorId: string) => {
    if (!(await confirmDialog("Remover este fator de autenticação?"))) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Fator removido");
    await loadFactors();
  };

  const signOutAll = async () => {
    if (!(await confirmDialog("Encerrar a sessão em todos os dispositivos?"))) return;
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Sessões encerradas. Faça login novamente.");
  };

  const activeTotp = factors.find((f) => f.factor_type === "totp" && f.status === "verified");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Segurança</h2>
        <p className="text-sm text-muted-foreground">
          Proteja sua conta com autenticação em dois fatores (2FA) e gerencie suas sessões.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {activeTotp ? (
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-600" />
            )}
            Autenticação em dois fatores (TOTP)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}

          {!loading && !enroll && (
            <>
              {factors.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum fator configurado. Recomendamos ativar 2FA usando um app como Google
                  Authenticator, 1Password ou Authy.
                </p>
              )}
              {factors.length > 0 && (
                <div className="space-y-2">
                  {factors.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between border rounded p-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant={f.status === "verified" ? "default" : "secondary"}>
                          {f.status === "verified" ? "Ativo" : "Pendente"}
                        </Badge>
                        <span className="font-medium">
                          {f.friendly_name || f.factor_type.toUpperCase()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(f.created_at)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFactor(f.id)}
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={startEnroll}>
                <ShieldCheck className="h-4 w-4 mr-2" />
                {activeTotp ? "Adicionar outro fator" : "Ativar 2FA"}
              </Button>
            </>
          )}

          {enroll && (
            <div className="space-y-3">
              <p className="text-sm">
                Escaneie o QR Code com seu app autenticador, depois digite o código de 6 dígitos.
              </p>
              <div className="flex items-start gap-4">
                {enroll.qr.startsWith("data:") ? (
                  <div className="bg-white p-2 rounded border w-44 h-44 flex items-center justify-center">
                    <img src={enroll.qr} alt="QR Code 2FA" className="w-40 h-40" />
                  </div>
                ) : (
                  <div
                    className="bg-white p-2 rounded border w-44 h-44 flex items-center justify-center [&_svg]:w-40 [&_svg]:h-40"
                    dangerouslySetInnerHTML={{ __html: enroll.qr }}
                  />
                )}
                <div className="space-y-2 flex-1">
                  <div className="space-y-1">
                    <Label className="text-xs">Chave manual</Label>
                    <code className="block text-xs bg-muted p-2 rounded break-all">
                      {enroll.secret}
                    </code>
                  </div>
                  <div className="space-y-1">
                    <Label>Código de 6 dígitos</Label>
                    <Input
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={verifyEnroll} disabled={verifying || code.length < 6}>
                      Confirmar
                    </Button>
                    <Button variant="ghost" onClick={cancelEnroll}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sessão atual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Email:</span> {session?.email ?? "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Provedor:</span> {session?.provider ?? "—"}
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Último login:</span>{" "}
              {session?.signedInAt ? formatDateTime(session.signedInAt) : "—"}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadSession}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="destructive" onClick={signOutAll}>
              <LogOut className="h-4 w-4 mr-2" />
              Encerrar sessões em todos os dispositivos
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Isso desconecta sua conta em todos os navegadores e celulares. Você precisará entrar
            novamente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
