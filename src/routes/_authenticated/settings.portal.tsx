import { getPublicAppUrl } from "@/lib/app-url";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  listPortalContacts,
  togglePortalAccess,
  regeneratePortalToken,
} from "@/lib/portal.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, RefreshCw, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/portal")({
  component: PortalSettingsPage,
});

function PortalSettingsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listPortalContacts);
  const toggle = useServerFn(togglePortalAccess);
  const regen = useServerFn(regeneratePortalToken);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["portal-contacts"],
    queryFn: () => list(),
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const all = data ?? [];
    if (!s) return all;
    return all.filter((c) =>
      `${c.first_name} ${c.last_name ?? ""} ${c.email ?? ""}`.toLowerCase().includes(s),
    );
  }, [data, search]);

  const toggleMutation = useMutation({
    mutationFn: (vars: { contactId: string; enabled: boolean }) => toggle({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-contacts"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });

  const regenMutation = useMutation({
    mutationFn: (contactId: string) => regen({ data: { contactId } }),
    onSuccess: () => {
      toast.success("Token regenerado.");
      qc.invalidateQueries({ queryKey: ["portal-contacts"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });

  function portalUrl(token: string) {
    return `${getPublicAppUrl()}/portal/${token}`;
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(portalUrl(token));
    toast.success("Link copiado!");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Portal do cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Habilite o portal por contato. Cada cliente recebe um link único onde pode ver suas
            solicitações (tickets) e abrir novas.
          </p>
          <Input
            placeholder="Buscar contato…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-28">Ativo</TableHead>
                  <TableHead className="w-64">Link público</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      Carregando…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      Nenhum contato.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        {c.first_name} {c.last_name ?? ""}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                      <TableCell>
                        <Switch
                          checked={c.portal_enabled}
                          onCheckedChange={(enabled) =>
                            toggleMutation.mutate({ contactId: c.id, enabled })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {c.portal_enabled && c.portal_token ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyLink(c.portal_token!)}
                            >
                              <Copy className="h-3.5 w-3.5 mr-1" />
                              Copiar
                            </Button>
                            <Button size="sm" variant="outline" asChild>
                              <a
                                href={portalUrl(c.portal_token)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => regenMutation.mutate(c.id)}
                              title="Gerar novo token"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Desativado</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
