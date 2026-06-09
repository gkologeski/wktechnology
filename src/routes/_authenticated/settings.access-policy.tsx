import { formatDateTime } from "@/lib/crm";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { getWorkspaceSecurity, updateWorkspaceSecurity, listIpAccessLog } from "@/lib/security.functions";

export const Route = createFileRoute("/_authenticated/settings/access-policy")({
  component: AccessPolicyPage,
});

function AccessPolicyPage() {
  const get = useServerFn(getWorkspaceSecurity);
  const update = useServerFn(updateWorkspaceSecurity);
  const logs = useServerFn(listIpAccessLog);
  const [sec, setSec] = useState<any>({});
  const [accessLog, setAccessLog] = useState<any[]>([]);
  const [newIp, setNewIp] = useState("");

  const load = async () => {
    const r = await get({});
    setSec(r.security ?? {});
    setAccessLog((await logs({})).items);
  };
  useEffect(() => { void load(); }, []);

  const save = async (patch: any) => {
    const next = { ...sec, ...patch };
    setSec(next);
    await update({ data: patch });
    toast.success("Salvo");
  };

  const addIp = async () => {
    if (!newIp.trim()) return;
    const list = [...(sec.ip_allowlist ?? []), newIp.trim()];
    await save({ ip_allowlist: list });
    setNewIp("");
  };
  const removeIp = async (ip: string) => {
    const list = (sec.ip_allowlist ?? []).filter((x: string) => x !== ip);
    await save({ ip_allowlist: list });
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Política de Acesso</h1>
        <p className="text-sm text-muted-foreground">Controle quem pode acessar este workspace e em que condições.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>IP allow-list</CardTitle>
          <CardDescription>Quando ativada, apenas IPs/faixas listados podem se autenticar. Use formato exato (1.2.3.4) ou prefixo /24.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch checked={!!sec.ip_allowlist_enabled} onCheckedChange={(v) => save({ ip_allowlist_enabled: v })} />
            <Label>Ativar enforcement</Label>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Ex.: 200.100.50.10 ou 200.100.50.0/24" value={newIp} onChange={(e) => setNewIp(e.target.value)} />
            <Button onClick={addIp}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
          </div>
          <div className="space-y-1">
            {(sec.ip_allowlist ?? []).map((ip: string) => (
              <div key={ip} className="border rounded p-2 flex justify-between items-center text-sm">
                <code>{ip}</code>
                <Button variant="ghost" size="sm" onClick={() => removeIp(ip)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {(sec.ip_allowlist ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nenhum IP cadastrado.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timeout de sessão</CardTitle>
          <CardDescription>Sessões inativas são encerradas após este período.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Input
              type="number" min={15} max={1440} className="w-32"
              value={sec.session_timeout_minutes ?? 720}
              onChange={(e) => setSec({ ...sec, session_timeout_minutes: parseInt(e.target.value || "0", 10) })}
              onBlur={(e) => save({ session_timeout_minutes: parseInt(e.target.value || "720", 10) })}
            />
            <span className="text-sm text-muted-foreground">minutos (15 – 1440)</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>MFA & SSO</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch checked={!!sec.require_mfa} onCheckedChange={(v) => save({ require_mfa: v })} />
            <Label>Exigir MFA para todos os usuários</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={!!sec.force_sso} onCheckedChange={(v) => save({ force_sso: v })} />
            <Label>Forçar SSO (desativa login/senha)</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tentativas bloqueadas recentes</CardTitle>
          <CardDescription>Últimos 100 eventos de IP fora da allow-list.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {accessLog.length === 0 && <p className="text-xs text-muted-foreground">Sem eventos.</p>}
          {accessLog.map((l) => (
            <div key={l.id} className="border rounded p-2 flex justify-between">
              <code className="text-xs">{l.ip_address}</code>
              <Badge variant={l.blocked ? "destructive" : "secondary"}>{l.blocked ? "blocked" : "allowed"}</Badge>
              <span className="text-xs text-muted-foreground">{formatDateTime(l.created_at)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
