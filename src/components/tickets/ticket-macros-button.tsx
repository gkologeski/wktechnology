import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { renderTokens } from "@/lib/message-tokens";

type Macro = {
  id: string;
  name: string;
  category: string | null;
  shortcut: string | null;
  body: string;
  enabled: boolean;
};

type Props = {
  ticket: {
    id: string;
    subject?: string | null;
    contact_id: string | null;
    company_id: string | null;
    deal_id: string | null;
  };
  onApplied?: () => void;
};

export function TicketMacrosButton({ ticket, onApplied }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const { data: macros = [] } = useQuery({
    queryKey: ["macros", "enabled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("macros")
        .select("id, name, category, shortcut, body, enabled")
        .eq("enabled", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Macro[];
    },
    enabled: open,
  });

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return macros;
    return macros.filter(
      (m) =>
        m.name.toLowerCase().includes(f) ||
        (m.shortcut ?? "").toLowerCase().includes(f) ||
        (m.category ?? "").toLowerCase().includes(f),
    );
  }, [macros, filter]);

  async function applyMacro(m: Macro) {
    if (!user) return;
    const related = {
      related_contact_id: ticket.contact_id,
      related_company_id: ticket.company_id,
      related_deal_id: ticket.deal_id,
    };
    // Resolve as variáveis oferecidas na edição de macros (MACRO_TOKENS).
    let contactName = "";
    let companyName = "";
    if (ticket.contact_id) {
      const { data: c } = await supabase
        .from("contacts")
        .select("first_name, last_name")
        .eq("id", ticket.contact_id)
        .maybeSingle();
      contactName = [c?.first_name, c?.last_name].filter(Boolean).join(" ");
    }
    if (ticket.company_id) {
      const { data: co } = await supabase
        .from("companies")
        .select("name")
        .eq("id", ticket.company_id)
        .maybeSingle();
      companyName = co?.name ?? "";
    }
    const body = renderTokens(m.body, {
      contact_first_name: contactName.split(" ")[0] ?? "",
      contact_name: contactName,
      company_name: companyName,
      ticket_subject: ticket.subject ?? "",
      agent_name:
        (user.user_metadata as { full_name?: string } | undefined)?.full_name ?? user.email ?? "",
    });

    const { error } = await supabase.from("activities").insert({
      owner_id: user.id,
      type: "note",
      subject: m.name,
      body,
      completed: true,
      ...related,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    try {
      await navigator.clipboard?.writeText(body);
    } catch {
      // ignore clipboard failures
    }

    toast.success(`Macro "${m.name}" aplicada — texto copiado.`);
    setOpen(false);
    setFilter("");
    onApplied?.();
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Sparkles className="h-4 w-4" />
          Aplicar macro
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Macros</DropdownMenuLabel>
        <div className="px-2 pb-2">
          <Input
            placeholder="Filtrar por nome, atalho ou categoria…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8"
            autoFocus
          />
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              {macros.length === 0 ? "Nenhuma macro cadastrada." : "Sem resultados."}
            </div>
          ) : (
            filtered.map((m) => (
              <DropdownMenuItem
                key={m.id}
                onSelect={(e) => {
                  e.preventDefault();
                  void applyMacro(m);
                }}
                className="flex-col items-start gap-0.5"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="font-medium truncate">{m.name}</span>
                  {m.shortcut && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      /{m.shortcut}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground truncate w-full">
                  {m.category ? `${m.category} · ` : ""}
                  {m.body.slice(0, 80)}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
