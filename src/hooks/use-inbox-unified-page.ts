// Lista paginada da Inbox unificada (RPC sob RLS) + tempo real filtrado.
import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInboxListRealtime } from "@/hooks/use-inbox-channel-page";
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

  // Realtime filtrado e coalescido (e-mail só das caixas do próprio usuário); reconexão e
  // volta da aba recarregam as páginas abertas, sem voltar ao topo.
  useInboxListRealtime(
    ["email", "whatsapp", "chat"],
    [["inbox-unified", "page", user?.id ?? "anon"]],
  );

  const rows = useMemo(() => mergeInboxPages(q.data?.pages ?? []), [q.data]);
  const first = q.data?.pages[0];
  return {
    rows,
    counts: first?.counts ?? null,
    total: first?.total ?? null,
    query: q,
  };
}
