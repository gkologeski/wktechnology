import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Play, Sparkles, Trash2, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  listProspectSearches,
  upsertProspectSearch,
  deleteProspectSearch,
  runProspectSearch,
  listProspectResults,
  importProspectAsLead,
} from "@/lib/prospecting.functions";

export const Route = createFileRoute("/_authenticated/settings/prospecting")({
  component: ProspectingPage,
});

type Row = Awaited<ReturnType<typeof listProspectSearches>>[number];
type Result = Awaited<ReturnType<typeof listProspectResults>>[number];

export function ProspectingPage() {
  const listFn = useServerFn(listProspectSearches);
  const saveFn = useServerFn(upsertProspectSearch);
  const delFn = useServerFn(deleteProspectSearch);
  const runFn = useServerFn(runProspectSearch);
  const resFn = useServerFn(listProspectResults);
  const impFn = useServerFn(importProspectAsLead);

  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const [openSearch, setOpenSearch] = useState<Row | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState<string | null>(null);

  const refresh = async () => setRows((await listFn()) as Row[]);
  useEffect(() => {
    refresh(); /* eslint-disable-next-line */
  }, []);

  const openResults = async (r: Row) => {
    setOpenSearch(r);
    setResults((await resFn({ data: { search_id: r.id } })) as Result[]);
  };

  const save = async () => {
    if (!editing) return;
    try {
      await saveFn({
        data: {
          id: (editing.id as string | undefined) ?? null,
          name: (editing.name as string) || "",
          industry: (editing.industry as string) ?? "",
          role_title: (editing.role_title as string) ?? "",
          company_size: (editing.company_size as string) ?? "",
          location: (editing.location as string) ?? "",
          keywords: (editing.keywords as string) ?? "",
          instructions: (editing.instructions as string) ?? "",
          max_results: (editing.max_results as number) ?? 10,
        },
      });
      toast.success("Salvo");
      setOpen(false);
      setEditing(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const runIt = async (r: Row) => {
    setRunning(r.id);
    try {
      const out = await runFn({ data: { id: r.id } });
      toast.success(`${out.count} prospects gerados`);
      await refresh();
      if (openSearch?.id === r.id) await openResults(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-semibold">Prospecting Agent</h2>
          <p className="text-sm text-muted-foreground">
            Defina seu ICP e deixe a IA gerar uma lista de prospects para revisar e importar como
            leads.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing({ max_results: 10 });
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova busca
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma busca ainda.</p>
          )}
          <div className="text-sm divide-y">
            {rows.map((r) => (
              <div key={r.id} className="py-2 flex items-center justify-between gap-3">
                <button className="text-left flex-1 min-w-0" onClick={() => openResults(r)}>
                  <div className="font-medium truncate flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    {String(r.name)}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[r.industry, r.role_title, r.location].filter(Boolean).join(" · ") || "—"}
                  </div>
                </button>
                <Badge
                  variant={
                    r.status === "completed"
                      ? "default"
                      : r.status === "failed"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {String(r.status)}
                </Badge>
                <span className="text-xs text-muted-foreground w-16 text-right">
                  {String(r.result_count ?? 0)} prospects
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => runIt(r)}
                  disabled={running === r.id}
                >
                  {running === r.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    if (confirm("Remover?")) {
                      await delFn({ data: { id: r.id } });
                      refresh();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar busca" : "Nova busca"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div>
              <Label>Nome</Label>
              <Input
                value={(editing?.name as string) ?? ""}
                onChange={(e) => setEditing((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Segmento/Indústria</Label>
                <Input
                  value={(editing?.industry as string) ?? ""}
                  onChange={(e) => setEditing((f) => ({ ...f, industry: e.target.value }))}
                  placeholder="SaaS B2B, e-commerce..."
                />
              </div>
              <div>
                <Label>Cargo alvo</Label>
                <Input
                  value={(editing?.role_title as string) ?? ""}
                  onChange={(e) => setEditing((f) => ({ ...f, role_title: e.target.value }))}
                  placeholder="CMO, Head de Vendas..."
                />
              </div>
              <div>
                <Label>Porte da empresa</Label>
                <Input
                  value={(editing?.company_size as string) ?? ""}
                  onChange={(e) => setEditing((f) => ({ ...f, company_size: e.target.value }))}
                  placeholder="50-200 funcionários"
                />
              </div>
              <div>
                <Label>Localização</Label>
                <Input
                  value={(editing?.location as string) ?? ""}
                  onChange={(e) => setEditing((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Brasil, São Paulo..."
                />
              </div>
            </div>
            <div>
              <Label>Palavras-chave</Label>
              <Input
                value={(editing?.keywords as string) ?? ""}
                onChange={(e) => setEditing((f) => ({ ...f, keywords: e.target.value }))}
                placeholder="automação, IA, growth"
              />
            </div>
            <div>
              <Label>Instruções extras</Label>
              <Textarea
                rows={2}
                value={(editing?.instructions as string) ?? ""}
                onChange={(e) => setEditing((f) => ({ ...f, instructions: e.target.value }))}
              />
            </div>
            <div>
              <Label>Máx resultados</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={(editing?.max_results as number) ?? 10}
                onChange={(e) =>
                  setEditing((f) => ({ ...f, max_results: parseInt(e.target.value, 10) || 10 }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!openSearch} onOpenChange={(v) => !v && setOpenSearch(null)}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{openSearch?.name as string}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {results.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum prospect ainda. Use ▶ para executar.
              </p>
            )}
            {results.map((r) => (
              <Card key={r.id}>
                <CardContent className="pt-4 space-y-1">
                  <div className="font-medium">
                    {String(r.contact_name || "—")}{" "}
                    <span className="text-muted-foreground text-xs">
                      · {String(r.role_title || "")}
                    </span>
                  </div>
                  <div className="text-sm">
                    {String(r.company_name || "")} {r.location ? `· ${String(r.location)}` : ""}
                  </div>
                  {r.email_hint ? (
                    <div className="text-xs text-muted-foreground">{String(r.email_hint)}</div>
                  ) : null}
                  {r.reason ? (
                    <p className="text-xs text-muted-foreground italic">{String(r.reason)}</p>
                  ) : null}
                  <div className="pt-2">
                    {r.imported_lead_id ? (
                      <Badge variant="secondary">Importado</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await impFn({ data: { result_id: r.id } });
                            toast.success("Lead criado");
                            if (openSearch) await openResults(openSearch);
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Erro");
                          }
                        }}
                      >
                        <UserPlus className="h-3.5 w-3.5 mr-1" />
                        Importar como Lead
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
