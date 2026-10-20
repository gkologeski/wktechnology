// Vincular um projeto existente ao negócio (antes ou depois do ganho). A busca só lista o que o
// usuário já pode ler; o banco confere permissão de editar negócio e projeto e o mesmo workspace.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/techhire/ui";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { searchProjectsForDeal } from "@/lib/projects/deal-delivery.functions";
import { GROUP_DEFAULT, groupLabel } from "@/lib/projects/deal-delivery-labels";
import { projectStatusLabel } from "@/lib/projects/delivery-labels";

export type GroupOption = { key: string; label: string | null };

export function LinkProjectDialog({
  open,
  dealId,
  groups,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  dealId: string;
  /** Grupos sem projeto ligado; vazio = entrega única. */
  groups: GroupOption[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: (input: { projectId: string; group: string; note: string | null }) => void;
}) {
  const search = useServerFn(searchProjectsForDeal);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [group, setGroup] = useState(GROUP_DEFAULT);
  const [note, setNote] = useState("");
  const dq = useDebouncedValue(q, 300);

  useEffect(() => {
    if (open) {
      setQ("");
      setPicked(null);
      setNote("");
      setGroup(groups[0]?.key ?? GROUP_DEFAULT);
    }
  }, [open, groups]);

  const list = useQuery({
    queryKey: ["deal-delivery-search", dealId, dq],
    queryFn: () => search({ data: { dealId, q: dq } }),
    enabled: open,
  });
  const chosen = (list.data ?? []).find((p) => p.id === picked) ?? null;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onCancel() : undefined)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Vincular projeto existente</DialogTitle>
          <DialogDescription>
            O projeto passa a atender este negócio. Horas, datas, status e cliente do projeto não
            são alterados.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Buscar projeto pelo nome"
              placeholder="Buscar projeto pelo nome"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8"
            />
          </div>
          <div
            className="max-h-64 overflow-y-auto rounded-md border"
            role="listbox"
            aria-label="Projetos"
          >
            {list.isLoading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : list.isError ? (
              <p className="p-3 text-sm text-destructive">Não foi possível buscar projetos.</p>
            ) : (list.data ?? []).length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Nenhum projeto encontrado.</p>
            ) : (
              (list.data ?? []).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={picked === p.id}
                  onClick={() => setPicked(p.id)}
                  className={`flex w-full items-start justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${picked === p.id ? "bg-muted" : ""}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {p.companyName ?? "Sem empresa"} · {projectStatusLabel(p.status)}
                    </span>
                  </span>
                  {p.hasOtherDeal && <StatusBadge status="onhold" label="Atende outro negócio" />}
                </button>
              ))
            )}
          </div>
          {groups.length > 1 && (
            <div className="space-y-1.5">
              <Label>Entrega atendida</Label>
              <RadioGroup value={group} onValueChange={setGroup} className="flex flex-wrap gap-3">
                {groups.map((g) => (
                  <label key={g.key} className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value={g.key} /> {groupLabel(g.key, g.label)}
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}
          {chosen?.hasOtherDeal && (
            <p className="text-xs text-muted-foreground">
              Este projeto já tem um negócio de origem; este negócio entra como consolidado, sem
              trocar a origem principal.
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="link-note">
              Justificativa (obrigatória se a empresa for diferente)
            </Label>
            <Textarea
              id="link-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button
            disabled={!picked || busy}
            onClick={() =>
              picked && onConfirm({ projectId: picked, group, note: note.trim() || null })
            }
          >
            {busy ? "Vinculando…" : "Vincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
