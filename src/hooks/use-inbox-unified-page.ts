// Lista paginada da Inbox unificada (RPC sob RLS) + reconciliação em tempo real.
import { useEffect, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  inboxPageKey,
  mergeInboxPages,
  parseInboxPage,
  type InboxChannelFilter,
  type InboxCursor,
  type InboxPage,
} from "@/lib/inbox/unified-page";

const PAGE_SIZE = 50;

export function useInboxUnifiedPage(channel: InboxChannelFilter, search: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = inboxPageKey(user?.id, channel, search);

  const q = useInfiniteQuery({
    queryKey: key,
    enabled: !!user?.id,
    initialPageParam: null as InboxCursor | null,
    // Mantém a lista anterior visível enquanto a nova busca/filtro carrega.
    placeholderData: (prev) => prev,
    queryFn: async ({ pageParam, signal }): Promise<InboxPage> => {
      const { data, error } = await supabase
        .rpc("get_inbox_unified_page", {
          p_channel: channel,
          p_search: search.trim() || undefined,
          p_cursor_at: pageParam?.at,
          p_cursor_src: pageParam?.src,
          p_cursor_id: pageParam?.id,
          p_page_size: PAGE_SIZE,
        })
        .abortSignal(signal);
      if (error) throw error;
      return parseInboxPage(data);
    },
    getNextPageParam: (last: InboxPage) => (last.hasMore ? last.nextCursor : undefined),
  });

  // Realtime: WhatsApp e chat estão na publicação; e-mail não (reconcilia ao focar a aba).
  // Eventos são agrupados em 400 ms e recarregam as páginas já abertas, sem voltar ao topo.
  useEffect(() => {
    if (!user?.id) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        void qc.invalidateQueries({ queryKey: ["inbox-unified", "page", user.id] });
      }, 400);
    };
    const ch = supabase
      .channel(`inbox-unified-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations" },
        bump,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "live_chat_sessions" }, bump)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(ch);
    };
  }, [qc, user?.id]);

  const rows = useMemo(() => mergeInboxPages(q.data?.pages ?? []), [q.data]);
  const first = q.data?.pages[0];
  return {
    rows,
    counts: first?.counts ?? null,
    total: first?.total ?? null,
    query: q,
  };
}
