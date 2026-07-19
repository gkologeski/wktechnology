import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Plus, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  createCategory,
  deleteCategory,
  listCategories,
} from "@/lib/finance.functions";
import {
  ALL_LEGAL_ENTITIES,
  LegalEntitySelect,
  useLegalEntities,
  useLegalEntityFilter,
} from "@/components/finance/legal-entity-select";

export const Route = createFileRoute("/_authenticated/finance/categories")({
  head: () => ({ meta: [{ title: "Plano de contas" }] }),
  component: CategoriesPage,
});

type Cat = {
  id: string;
  name: string;
  kind: "revenue" | "expense";
  code: string | null;
  parent_id: string | null;
  legal_entity_id: string | null;
};

type Node = Cat & { children: Node[] };

function buildTree(rows: Cat[]): { revenue: Node[]; expense: Node[] } {
  const byId = new Map<string, Node>();
  rows.forEach((r) => byId.set(r.id, { ...r, children: [] }));
  const roots: Node[] = [];
  byId.forEach((n) => {
    if (n.parent_id && byId.has(n.parent_id)) {
      byId.get(n.parent_id)!.children.push(n);
    } else {
      roots.push(n);
    }
  });
  const sortNode = (nodes: Node[]) => {
    nodes.sort((a, b) => {
      const ac = a.code ?? "";
      const bc = b.code ?? "";
      if (ac && bc) return ac.localeCompare(bc, "pt-BR");
      return a.name.localeCompare(b.name, "pt-BR");
    });
    nodes.forEach((n) => sortNode(n.children));
  };
  sortNode(roots);
  return {
    revenue: roots.filter((n) => n.kind === "revenue"),
    expense: roots.filter((n) => n.kind === "expense"),
  };
}

function CategoriesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listCategories);
  const create = useServerFn(createCategory);
  const del = useServerFn(deleteCategory);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"revenue" | "expense">("revenue");
  const [code, setCode] = useState("");
  const [parentId, setParentId] = useState<string>("__root__");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: rows = [] } = useQuery({
    queryKey: ["finance-categories"],
    queryFn: () => list() as Promise<Cat[]>,
  });

  const tree = useMemo(() => buildTree(rows), [rows]);
  const parentOptions = useMemo(
    () => rows.filter((r) => r.kind === kind),
    [rows, kind],
  );

  function openCreate(preset?: { kind?: "revenue" | "expense"; parent?: string | null }) {
    setName("");
    setCode("");
    if (preset?.kind) setKind(preset.kind);
    setParentId(preset?.parent ?? "__root__");
    setOpen(true);
  }

  async function submit() {
    if (!name.trim()) return;
    try {
      await create({
        data: {
          name: name.trim(),
          kind,
          code: code.trim() || null,
          parent_id: parentId === "__root__" ? null : parentId,
        },
      });
      toast.success("Categoria criada");
      qc.invalidateQueries({ queryKey: ["finance-categories"] });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir categoria? Subcategorias ficarão sem pai.")) return;
    try {
      await del({ data: { id } });
      qc.invalidateQueries({ queryKey: ["finance-categories"] });
      toast.success("Removida");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  }

  function renderNode(node: Node, depth: number) {
    const hasChildren = node.children.length > 0;
    const isOpen = expanded[node.id] ?? true;
    return (
      <div key={node.id}>
        <div
          className="group flex items-center gap-2 border-b px-3 py-2 hover:bg-muted/40"
          style={{ paddingLeft: 12 + depth * 20 }}
        >
          <button
            type="button"
            onClick={() => hasChildren && toggle(node.id)}
            className="text-muted-foreground"
            aria-label={hasChildren ? (isOpen ? "Recolher" : "Expandir") : "Sem filhos"}
          >
            {hasChildren ? (
              isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )
            ) : (
              <span className="inline-block h-4 w-4" />
            )}
          </button>
          {node.code && (
            <span className="font-mono text-xs text-muted-foreground">{node.code}</span>
          )}
          <span className="font-medium">{node.name}</span>
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openCreate({ kind: node.kind, parent: node.id })}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Subcategoria
            </Button>
            <Button size="icon" variant="ghost" onClick={() => remove(node.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {hasChildren && isOpen && node.children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  }

  function renderSection(title: string, variant: "revenue" | "expense", nodes: Node[]) {
    return (
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {variant === "revenue" ? "Receitas" : "Despesas"}
            </Badge>
            <h3 className="text-sm font-medium">{title}</h3>
          </div>
          <Button size="sm" variant="outline" onClick={() => openCreate({ kind: variant, parent: null })}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Conta raiz
          </Button>
        </div>
        {nodes.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma conta cadastrada.
          </div>
        ) : (
          <div>{nodes.map((n) => renderNode(n, 0))}</div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Plano de contas"
        description="Estrutura hierárquica de receitas e despesas para o DRE gerencial."
        actions={
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4 mr-1" /> Nova conta
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {renderSection("Contas de receita", "revenue", tree.revenue)}
        {renderSection("Contas de despesa", "expense", tree.expense)}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova conta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={kind}
                  onValueChange={(v) => {
                    setKind(v as "revenue" | "expense");
                    setParentId("__root__");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Código</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ex: 3.1.01"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Conta pai (opcional)</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__root__">— Nenhuma (raiz) —</SelectItem>
                  {parentOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code ? `${p.code} · ` : ""}
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
