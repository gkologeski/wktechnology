import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { listApiKeys, createApiKey, revokeApiKey, deleteApiKey } from "@/lib/api-keys.functions";
import { Copy, KeyRound, Trash2, Ban } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/api-keys")({
  component: ApiKeysPage,
});

type Row = { id: string; name: string; prefix: string; scopes: string[]; last_used_at: string | null; expires_at: string | null; revoked_at: string | null; created_at: string };

function ApiKeysPage() {
  const list = useServerFn(listApiKeys);
  const create = useServerFn(createApiKey);
  const revoke = useServerFn(revokeApiKey);
  const remove = useServerFn(deleteApiKey);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [secret, setSecret] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { const r = await list({}); setRows(r.keys as Row[]); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const toggle = (s: string) => setScopes((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);

  const onCreate = async () => {
    if (!name.trim()) return;
    try {
      const r = await create({ data: { name: name.trim(), scopes: scopes as ("read"|"write")[] } });
      setSecret(r.secret);
      setName("");
      setScopes(["read"]);
      await load();
    } catch (e) { toast.error((e as Error).message); }
  };

  const copy = (v: string) => { navigator.clipboard.writeText(v); toast.success("Copiado"); };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">API Keys</h1>
          <p className="text-sm text-muted-foreground">Use estas chaves para acessar a API pública REST em <code className="text-xs">/api/public/v1/*</code></p>
        </div>
        <Button onClick={() => setOpen(true)}><KeyRound className="h-4 w-4 mr-2" /> Nova chave</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Endpoints disponíveis</CardTitle>
          <CardDescription>Envie sua chave em <code>Authorization: Bearer SUA_CHAVE</code></CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><Badge variant="secondary">GET</Badge> <code>/api/public/v1/contacts</code></div>
          <div><Badge variant="secondary">POST</Badge> <code>/api/public/v1/contacts</code></div>
          <div><Badge variant="secondary">GET</Badge> <code>/api/public/v1/leads</code></div>
          <div><Badge variant="secondary">POST</Badge> <code>/api/public/v1/leads</code></div>
          <div><Badge variant="secondary">GET</Badge> <code>/api/public/v1/deals</code></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Suas chaves</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> :
           rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma chave criada.</p> :
           <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between border rounded-md p-3">
                <div className="space-y-1">
                  <div className="font-medium flex items-center gap-2">
                    {r.name}
                    {r.revoked_at && <Badge variant="destructive">Revogada</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">{r.prefix}…</div>
                  <div className="flex gap-1">{r.scopes.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}</div>
                </div>
                <div className="flex gap-2">
                  {!r.revoked_at && (
                    <Button variant="outline" size="sm" onClick={async () => { await revoke({ data: { id: r.id } }); load(); }}>
                      <Ban className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={async () => { await remove({ data: { id: r.id } }); load(); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
           </div>}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSecret(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{secret ? "Chave criada" : "Nova chave"}</DialogTitle>
            {secret && <DialogDescription>Copie agora — não será exibida novamente.</DialogDescription>}
          </DialogHeader>
          {secret ? (
            <div className="space-y-2">
              <code className="block break-all p-3 bg-muted rounded-md text-xs">{secret}</code>
              <Button onClick={() => copy(secret)}><Copy className="h-4 w-4 mr-2" /> Copiar</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Integração Zapier" />
              </div>
              <div>
                <Label>Permissões</Label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={scopes.includes("read")} onCheckedChange={() => toggle("read")} /> Read
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={scopes.includes("write")} onCheckedChange={() => toggle("write")} /> Write
                  </label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {secret ? (
              <Button onClick={() => { setOpen(false); setSecret(null); }}>Fechar</Button>
            ) : (
              <Button onClick={onCreate} disabled={!name.trim()}>Criar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
