import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addQueueItems } from "@/lib/task-queues.functions";

type Contact = { id: string; first_name: string; last_name: string | null; email: string | null };

export function AddQueueItemsDialog({ queueId }: { queueId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const q = useQuery({
    queryKey: ["contacts_picker", search, open],
    enabled: open && search.trim().length >= 3,
    queryFn: async () => {
      const term = search.trim();
      const tokens = term.split(/\s+/).filter(Boolean);
      const cols = ["first_name", "last_name", "email"];
      let q = supabase.from("contacts").select("id, first_name, last_name, email");
      for (const tok of tokens) {
        const safe = tok.replace(/[%,()]/g, " ");
        q = q.or(cols.map((c) => `${c}.ilike.%${safe}%`).join(","));
      }
      const { data, error } = await q.order("created_at", { ascending: false }).limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as Contact[];
    },
  });

  const addFn = useServerFn(addQueueItems);
  const addMut = useMutation({
    mutationFn: () => {
      const ids = Object.keys(selected).filter((k) => selected[k]);
      return addFn({
        data: {
          queue_id: queueId,
          items: ids.map((id) => ({ contact_id: id })),
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`${res.added} adicionados à fila`);
      setSelected({});
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["task_queues"] });
      qc.invalidateQueries({ queryKey: ["task_queue", queueId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const count = Object.values(selected).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-1 h-4 w-4" /> Adicionar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Adicionar contatos à fila</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Buscar por nome ou email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-96 overflow-auto rounded border">
          {search.trim().length < 3 ? (
            <p className="p-3 text-sm text-muted-foreground">
              Digite ao menos 3 caracteres para buscar.
            </p>
          ) : q.isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <>
              {q.data?.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 border-b px-3 py-2 last:border-0 hover:bg-muted"
                >
                  <Checkbox
                    checked={!!selected[c.id]}
                    onCheckedChange={(v) => setSelected((s) => ({ ...s, [c.id]: !!v }))}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {c.first_name} {c.last_name ?? ""}
                    </div>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  </div>
                </label>
              ))}
              {q.data?.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">Sem resultados.</p>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => addMut.mutate()} disabled={!count || addMut.isPending}>
            Adicionar {count > 0 ? `(${count})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
