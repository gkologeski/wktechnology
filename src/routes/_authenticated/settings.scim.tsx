import { getPublicAppUrl } from "@/lib/app-url";
import { formatDateTime } from "@/lib/crm";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Copy, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { listScimTokens, createScimToken, revokeScimToken } from "@/lib/scim.functions";

export const Route = createFileRoute("/_authenticated/settings/scim")({
  component: ScimPage,
});

const BASE = getPublicAppUrl();

function ScimPage() {
  const list = useServerFn(listScimTokens);
  const create = useServerFn(createScimToken);
  const revoke = useServerFn(revokeScimToken);
  const [tokens, setTokens] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);

  const load = async () => setTokens((await list({})).items);
  useEffect(() => {
    void load();
  }, []);

  const onCreate = async () => {
    if (!name.trim()) return toast.error("Informe um nome");
    const r = await create({ data: { name } });
    setNewToken(r.token);
    setName("");
    await load();
  };

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    toast.success("Copiado");
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">SCIM 2.0 — Provisionamento</h1>
        <p className="text-sm text-muted-foreground">
          Conecte Okta, Azure AD ou outro IdP para criar e desativar usuários automaticamente.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
          <CardDescription>Cole estes valores no seu IdP.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Base URL" value={`${BASE}/api/public/scim/v2`} onCopy={copy} />
          <Row label="Users" value={`${BASE}/api/public/scim/v2/Users`} onCopy={copy} />
          <Row label="Groups" value={`${BASE}/api/public/scim/v2/Groups`} onCopy={copy} />
          <p className="text-xs text-muted-foreground">
            Autenticação: <code>Authorization: Bearer scim_…</code>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tokens</CardTitle>
          <CardDescription>
            Gere um token por integração. O valor completo é mostrado uma única vez.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Ex.: Okta produção"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button onClick={onCreate}>
              <Plus className="h-4 w-4 mr-1" /> Gerar
            </Button>
          </div>

          {newToken && (
            <div className="border border-amber-300 bg-amber-50 rounded-md p-3 text-sm space-y-2">
              <div className="flex items-center gap-2 font-medium text-amber-900">
                <ShieldAlert className="h-4 w-4" /> Copie e guarde — o token não será mostrado
                novamente
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all text-xs bg-white border rounded p-2">
                  {newToken}
                </code>
                <Button size="sm" variant="outline" onClick={() => copy(newToken)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {tokens.map((t) => (
              <div
                key={t.id}
                className="border rounded-md p-3 flex items-center justify-between gap-2"
              >
                <div className="text-sm">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    <code>{t.token_prefix}…</code> · criado em {formatDateTime(t.created_at)}
                    {t.last_used_at && <> · usado {formatDateTime(t.last_used_at)}</>}
                  </div>
                </div>
                {t.revoked_at ? (
                  <Badge variant="secondary">Revogado</Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await revoke({ data: { id: t.id } });
                      load();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {tokens.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum token criado.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div>
        <Label className="text-xs">{label}</Label>
        <div className="font-mono text-xs break-all">{value}</div>
      </div>
      <Button size="sm" variant="outline" onClick={() => onCopy(value)}>
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}
