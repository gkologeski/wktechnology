import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Building2, ChevronRight, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { deniedIfUnaffected } from "@/lib/access-control/rls-denied";

type MiniCompany = { id: string; name: string; domain: string | null };

export function CompanyHierarchy({
  companyId,
  parentId,
  ownerId,
}: {
  companyId: string;
  parentId: string | null;
  ownerId: string;
}) {
  const qc = useQueryClient();

  const { data: parent } = useQuery({
    queryKey: ["company-parent", companyId],
    queryFn: async () => {
      const { data: self } = await supabase
        .from("companies")
        .select("parent_company_id")
        .eq("id", companyId)
        .maybeSingle();
      const pid = self?.parent_company_id ?? null;
      if (!pid) return null;
      const { data } = await supabase
        .from("companies")
        .select("id, name, domain")
        .eq("id", pid)
        .maybeSingle();
      return (data as MiniCompany | null) ?? null;
    },
  });

  const { data: children = [] } = useQuery({
    queryKey: ["company-children", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name, domain")
        .eq("parent_company_id", companyId)
        .is("deleted_at", null)
        .order("name");
      return (data ?? []) as MiniCompany[];
    },
  });

  const setParent = async (newParent: string | null) => {
    const { data: affected, error } = await supabase
      .from("companies")
      .update({ parent_company_id: newParent })
      .eq("id", companyId)
      .select("id");
    if (error) return toast.error(error.message);
    if (deniedIfUnaffected(affected)) return;

    toast.success(newParent ? "Matriz vinculada" : "Vínculo removido");
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["company-parent", companyId] }),
      qc.invalidateQueries({ queryKey: ["company-children"] }),
      qc.invalidateQueries({ queryKey: ["companies"] }),
    ]);
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Hierarquia</h3>
        <PickParentDialog
          companyId={companyId}
          ownerId={ownerId}
          excludeIds={[companyId, ...children.map((c) => c.id)]}
          onPick={setParent}
        />
      </div>

      <div className="space-y-3">
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Matriz
          </div>
          {parent ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
              <Link
                to="/companies/$id"
                params={{ id: parent.id }}
                className="flex min-w-0 items-center gap-2 text-sm text-primary hover:underline"
              >
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{parent.name}</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setParent(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sem matriz vinculada</p>
          )}
        </div>

        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Filiais ({children.length})
          </div>
          {children.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma filial</p>
          ) : (
            <ul className="space-y-1">
              {children.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/companies/$id"
                    params={{ id: c.id }}
                    className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function PickParentDialog({
  ownerId,
  excludeIds,
  onPick,
}: {
  companyId: string;
  ownerId: string;
  excludeIds: string[];
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data: results = [] } = useQuery({
    queryKey: ["company-pick-parent", ownerId, debounced],
    enabled: open,
    queryFn: async () => {
      let query = supabase
        .from("companies")
        .select("id, name, domain")
        .is("deleted_at", null)
        .order("name")
        .limit(20);
      const term = debounced.trim();
      if (term)
        query = query.or(`name.ilike.%${term}%,domain.ilike.%${term}%,phone.ilike.%${term}%`);
      const { data } = await query;
      return (data ?? []) as MiniCompany[];
    },
  });

  const filtered = useMemo(
    () => results.filter((r) => !excludeIds.includes(r.id)),
    [results, excludeIds],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
          <Pencil className="h-3 w-3" /> Vincular matriz
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Selecionar empresa matriz</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Buscar empresa…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="max-h-72 overflow-auto rounded-md border">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">Nenhuma empresa</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onPick(c.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50"
              >
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.name}</div>
                  {c.domain && (
                    <div className="truncate text-xs text-muted-foreground">{c.domain}</div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
