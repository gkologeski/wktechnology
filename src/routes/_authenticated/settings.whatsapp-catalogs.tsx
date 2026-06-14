import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, RefreshCw, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listWabas,
  listCatalogs,
  addCatalog,
  syncCatalogProducts,
  listCatalogProducts,
} from "@/lib/whatsapp-meta.functions";

export const Route = createFileRoute("/_authenticated/settings/whatsapp-catalogs")({
  component: CatalogsPage,
});

function CatalogsPage() {
  const fetchWabas = useServerFn(listWabas);
  const fetchCatalogs = useServerFn(listCatalogs);
  const add = useServerFn(addCatalog);
  const sync = useServerFn(syncCatalogProducts);
  const listProducts = useServerFn(listCatalogProducts);

  const [wabas, setWabas] = useState<any[]>([]);
  const [catalogs, setCatalogs] = useState<any[]>([]);
  const [products, setProducts] = useState<Record<string, any[]>>({});
  const [wabaId, setWabaId] = useState("");
  const [catalogId, setCatalogId] = useState("");
  const [catName, setCatName] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [w, c] = await Promise.all([fetchWabas(), fetchCatalogs()]);
    setWabas(w as any[]);
    setCatalogs(c as any[]);
    if (!wabaId && (w as any[]).length) setWabaId((w as any[])[0].id);
  }
  useEffect(() => {
    refresh();
  }, []);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!wabaId || !catalogId) return;
    setBusy(true);
    try {
      await add({
        data: { waba_row_id: wabaId, catalog_id: catalogId, name: catName || undefined },
      });
      toast.success("Catálogo adicionado");
      setCatalogId("");
      setCatName("");
      refresh();
    } catch (err: any) {
      toast.error(err?.message || "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function onSync(rowId: string) {
    if (!wabaId) return toast.error("Selecione uma WABA acima");
    try {
      const r = await sync({ data: { catalog_row_id: rowId, waba_row_id: wabaId } });
      toast.success(`${(r as any).synced} produtos sincronizados`);
      const items = await listProducts({ data: { catalog_row_id: rowId } });
      setProducts((p) => ({ ...p, [rowId]: items as any[] }));
    } catch (err: any) {
      toast.error(err?.message || "Falha ao sincronizar");
    }
  }

  return (
    <div className="container mx-auto max-w-5xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catálogos WhatsApp</h1>
        <p className="text-muted-foreground text-sm">
          Cache do Commerce Manager para envio de listas de produtos via mensagem interativa.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="size-4" /> Adicionar catálogo
          </CardTitle>
          <CardDescription>
            Copie o Catalog ID do Commerce Manager (Meta Business Suite).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onAdd} className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>WABA</Label>
              <Select value={wabaId} onValueChange={setWabaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha…" />
                </SelectTrigger>
                <SelectContent>
                  {wabas.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.business_name || w.waba_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Catalog ID</Label>
              <Input
                value={catalogId}
                onChange={(e) => setCatalogId(e.target.value)}
                placeholder="1234567890"
              />
            </div>
            <div className="space-y-1">
              <Label>Nome (opcional)</Label>
              <Input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Loja Principal"
              />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={busy || !wabaId || !catalogId}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <Plus className="size-4 mr-2" />
                )}
                Adicionar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="size-4" /> Catálogos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {catalogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum catálogo cadastrado.</p>
          ) : (
            catalogs.map((c) => (
              <div key={c.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{c.name || c.catalog_id}</div>
                    <div className="text-xs text-muted-foreground font-mono">{c.catalog_id}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => onSync(c.id)}>
                    <RefreshCw className="size-4 mr-1" /> Sincronizar produtos
                  </Button>
                </div>
                {products[c.id]?.length ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {products[c.id].slice(0, 12).map((p) => (
                      <div
                        key={p.id}
                        className="text-xs flex items-center gap-2 border rounded p-2"
                      >
                        {p.image_url && (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="size-10 object-cover rounded"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.name}</div>
                          <div className="text-muted-foreground">
                            {p.price} {p.currency}
                          </div>
                        </div>
                        <Badge variant="secondary" className="ml-auto">
                          {p.availability}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
