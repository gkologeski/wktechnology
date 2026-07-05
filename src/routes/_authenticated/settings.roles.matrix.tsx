// /settings/roles/matrix — visão comparativa: o que cada perfil enxerga ao logar.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Crown, Shield, ShieldCheck } from "lucide-react";
import { ACCESS_OBJECTS, ACCESS_TOOLS, SCOPE_LABELS } from "@/lib/access-profiles.constants";
import { getAccessMatrix } from "@/lib/access-profiles.functions";

export const Route = createFileRoute("/_authenticated/settings/roles/matrix")({
  component: MatrixPage,
});

type Scope = "none" | "own" | "team" | "all";

function ScopeBadge({ value }: { value: Scope }) {
  const variant: "outline" | "secondary" | "default" | "destructive" =
    value === "all"
      ? "default"
      : value === "team"
        ? "secondary"
        : value === "own"
          ? "outline"
          : "destructive";
  return (
    <Badge variant={variant} className="text-[10px] font-normal">
      {SCOPE_LABELS[value]}
    </Badge>
  );
}

function MatrixPage() {
  const fn = useServerFn(getAccessMatrix);
  const { data, isLoading } = useQuery({
    queryKey: ["access-matrix"],
    queryFn: () => fn(),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
        <p className="font-medium text-amber-700 dark:text-amber-400">Tela legada</p>
        <p className="text-muted-foreground mt-1">
          A matriz oficial de permissões agora vive em{" "}
          <Link to="/home/access" className="underline font-medium text-foreground">Controle de Acesso</Link>.
        </p>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">O que cada perfil enxerga</h2>
          <p className="text-sm text-muted-foreground">
            Visão comparativa de todos os perfis do workspace: escopo por objeto e ferramentas
            disponíveis. É o que o usuário vê ao logar com cada perfil.
          </p>
        </div>
        <Link to="/settings/roles">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Voltar
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfis especiais (sempre presentes)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              <span className="font-medium text-sm">Owner do workspace</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Bypass total. Único que enxerga Billing/Assinatura e exclusão do workspace. Sempre
              tratado como Admin, ignora limites de perfil.
            </p>
          </div>
          <div className="rounded-md border p-3 space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-violet-500" />
              <span className="font-medium text-sm">Platform Admin (super-admin)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Equipe Lovable. Vê o menu <strong>Admin</strong> (workspaces, quotas, status,
              bug-reports, security-scans). Ignora RLS de workspace.
            </p>
          </div>
        </CardContent>
      </Card>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando matriz…</p>}

      {!isLoading && data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Escopo por objeto (view · edit · delete · create)
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="text-left p-2 sticky left-0 bg-background z-10 border-b">
                      Objeto
                    </th>
                    {data.profiles.map((p) => (
                      <th key={p.id} className="text-left p-2 border-b min-w-[180px]">
                        <div className="flex items-center gap-1.5">
                          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{p.name}</span>
                          {p.is_system && (
                            <Badge variant="secondary" className="text-[9px] px-1">
                              Sistema
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                          {p.user_count} usuário(s) · base: {p.base_role}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ACCESS_OBJECTS.map((obj) => (
                    <tr key={obj.key} className="hover:bg-muted/30">
                      <td className="p-2 sticky left-0 bg-background z-10 border-b font-medium">
                        {obj.label}
                        <div className="text-[10px] text-muted-foreground font-normal">
                          {obj.category}
                        </div>
                      </td>
                      {data.profiles.map((p) => {
                        const perm = data.permissions[p.id]?.[obj.key];
                        if (!perm)
                          return (
                            <td key={p.id} className="p-2 border-b text-xs text-muted-foreground">
                              —
                            </td>
                          );
                        return (
                          <td key={p.id} className="p-2 border-b">
                            <div className="flex flex-wrap gap-1">
                              <span className="text-[10px] text-muted-foreground">V:</span>
                              <ScopeBadge value={perm.view_scope as Scope} />
                              <span className="text-[10px] text-muted-foreground">E:</span>
                              <ScopeBadge value={perm.edit_scope as Scope} />
                              <span className="text-[10px] text-muted-foreground">D:</span>
                              <ScopeBadge value={perm.delete_scope as Scope} />
                              {perm.create_enabled && (
                                <Badge variant="outline" className="text-[10px]">
                                  +criar
                                </Badge>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-muted-foreground mt-3">
                <strong>Escopos:</strong> Nenhum = não vê · Próprios = só registros atribuídos a si
                · Equipe = todos do workspace · Todos = workspace inteiro inclusive admin.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ferramentas habilitadas</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="text-left p-2 sticky left-0 bg-background z-10 border-b">
                      Ferramenta
                    </th>
                    {data.profiles.map((p) => (
                      <th key={p.id} className="text-left p-2 border-b min-w-[140px]">
                        <span className="font-medium">{p.name}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ACCESS_TOOLS.map((tool) => (
                    <tr key={tool.key} className="hover:bg-muted/30">
                      <td className="p-2 sticky left-0 bg-background z-10 border-b">
                        <div className="font-medium">{tool.label}</div>
                        <div className="text-[10px] text-muted-foreground">{tool.description}</div>
                      </td>
                      {data.profiles.map((p) => {
                        const enabled = data.tools[p.id]?.[tool.key];
                        return (
                          <td key={p.id} className="p-2 border-b">
                            {enabled ? (
                              <Badge className="text-[10px]">ON</Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-muted-foreground"
                              >
                                OFF
                              </Badge>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
