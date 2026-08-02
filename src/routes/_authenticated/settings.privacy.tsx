import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { exportMyData, requestAccountDeletion } from "@/lib/lgpd.functions";
import { supabase } from "@/integrations/supabase/client";
import { confirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/_authenticated/settings/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  const exportFn = useServerFn(exportMyData);
  const deleteFn = useServerFn(requestAccountDeletion);
  const [exporting, setExporting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const data = await exportFn();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download iniciado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (!(await confirmDialog("Esta ação é IRREVERSÍVEL. Tem certeza?"))) return;
    setDeleting(true);
    try {
      await deleteFn({ data: { confirm } });
      await supabase.auth.signOut();
      toast.success("Conta excluída. Redirecionando…");
      window.location.href = "/login";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir conta");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4 p-6 max-w-2xl">
      <PageHeader
        title="Privacidade & Meus Dados"
        description="Direitos LGPD: exportar seus dados pessoais e excluir sua conta."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-4 w-4" /> Exportar meus dados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Baixe um arquivo JSON com seus dados pessoais armazenados na plataforma (perfil,
            vínculos com workspaces, papéis, notificações, integrações conectadas).
          </p>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Baixar JSON
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-4 w-4" /> Excluir minha conta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Esta ação remove permanentemente sua conta de acesso e seus vínculos com workspaces. Se
            você é proprietário de um workspace com assinatura ativa, cancele a assinatura ou
            transfira a propriedade antes.
          </p>
          <div className="space-y-2">
            <Label htmlFor="confirm">
              Para confirmar, digite{" "}
              <code className="rounded bg-muted px-1">EXCLUIR MINHA CONTA</code>
            </Label>
            <Input
              id="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="EXCLUIR MINHA CONTA"
            />
          </div>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting || confirm !== "EXCLUIR MINHA CONTA"}
          >
            {deleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Excluir conta permanentemente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
