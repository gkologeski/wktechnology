import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageCircle, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inbox/")({
  component: UnifiedInboxPage,
});

type Item = {
  id: string;
  channel: "email" | "whatsapp";
  title: string;
  snippet: string;
  contactLabel: string;
  lastAt: string | null;
  href: string;
};

function UnifiedInboxPage() {
  const [channel, setChannel] = useState<"all" | "email" | "whatsapp">("all");
  const [search, setSearch] = useState("");

  const emailQ = useQuery({
    queryKey: ["inbox-unified", "email"],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_threads")
        .select("id, subject, snippet, last_message_at, contact_id")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(150);
      return data ?? [];
    },
  });
  const waQ = useQuery({
    queryKey: ["inbox-unified", "whatsapp"],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_conversations")
        .select("id, contact_phone, last_message_preview, last_message_at, contact_id, status")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(150);
      return data ?? [];
    },
  });

  const contactIds = useMemo(() => {
    const s = new Set<string>();
    (emailQ.data ?? []).forEach((t) => t.contact_id && s.add(t.contact_id));
    (waQ.data ?? []).forEach((t) => t.contact_id && s.add(t.contact_id));
    return Array.from(s);
  }, [emailQ.data, waQ.data]);

  const contactsQ = useQuery({
    queryKey: ["inbox-unified", "contacts", contactIds.sort().join(",")],
    enabled: contactIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email")
        .in("id", contactIds);
      const m = new Map<string, string>();
      (data ?? []).forEach((c) => m.set(c.id,
        [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.email || c.id.slice(0, 8)
      ));
      return m;
    },
  });

  const items: Item[] = useMemo(() => {
    const m = contactsQ.data ?? new Map<string, string>();
    const a: Item[] = (emailQ.data ?? []).map((t) => ({
      id: `email:${t.id}`,
      channel: "email" as const,
      title: t.subject || "(sem assunto)",
      snippet: t.snippet ?? "",
      contactLabel: t.contact_id ? (m.get(t.contact_id) ?? "—") : "—",
      lastAt: t.last_message_at,
      href: `/inbox/email`,
    }));
    const b: Item[] = (waQ.data ?? []).map((c) => ({
      id: `wa:${c.id}`,
      channel: "whatsapp" as const,
      title: c.contact_id ? (m.get(c.contact_id) ?? c.contact_phone) : c.contact_phone,
      snippet: c.last_message_preview ?? "",
      contactLabel: c.contact_id ? (m.get(c.contact_id) ?? c.contact_phone) : c.contact_phone,
      lastAt: c.last_message_at,
      href: `/inbox/whatsapp`,
    }));
    let merged = [...a, ...b];
    if (channel !== "all") merged = merged.filter((i) => i.channel === channel);
    if (search.trim()) {
      const q = search.toLowerCase();
      merged = merged.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        i.snippet.toLowerCase().includes(q) ||
        i.contactLabel.toLowerCase().includes(q)
      );
    }
    merged.sort((x, y) => (new Date(y.lastAt ?? 0).getTime()) - (new Date(x.lastAt ?? 0).getTime()));
    return merged;
  }, [emailQ.data, waQ.data, contactsQ.data, channel, search]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inbox unificada"
        description="Conversas de e-mail e WhatsApp em um só lugar."
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por contato, assunto ou texto…"
            className="pl-8"
          />
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant={channel === "all" ? "default" : "outline"} onClick={() => setChannel("all")}>
            Todos
          </Button>
          <Button size="sm" variant={channel === "email" ? "default" : "outline"} onClick={() => setChannel("email")}>
            <Mail className="h-4 w-4 mr-1" /> E-mail
          </Button>
          <Button size="sm" variant={channel === "whatsapp" ? "default" : "outline"} onClick={() => setChannel("whatsapp")}>
            <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {emailQ.isLoading || waQ.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando…</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma conversa encontrada.</p>
          ) : (
            <ul className="divide-y">
              {items.map((it) => (
                <li key={it.id}>
                  <Link
                    to={it.href}
                    className="flex items-start gap-3 p-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="shrink-0 mt-0.5">
                      {it.channel === "email"
                        ? <Mail className="h-4 w-4 text-primary" />
                        : <MessageCircle className="h-4 w-4 text-emerald-500" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{it.contactLabel}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">{it.channel}</Badge>
                      </div>
                      <div className="text-sm truncate text-foreground/80">{it.title}</div>
                      {it.snippet && (
                        <div className="text-xs text-muted-foreground truncate">{it.snippet}</div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                      {it.lastAt ? new Date(it.lastAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : ""}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
