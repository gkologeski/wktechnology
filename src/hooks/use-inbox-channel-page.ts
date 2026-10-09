// Lista paginada de um canal da Inbox + tempo real filtrado e coalescido.
import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { listInboxChannelPage } from "@/lib/inbox/channel-page.functions";
import {
  channelPageKey,
  emailAccountsFilter,
  mergeChannelPages,
  parseChannelPage,
  type AssigneeFilter,
  type ChannelCursor,
  type ChannelKind,
  type ChannelPage,
} from "@/lib/inbox/channel-page";
import { useRealtimeInvalidate, type RealtimeSubscription } from "@/hooks/use-realtime-invalidate";

/** IDs das caixas de e-mail do próprio usuário (RLS: owner_id = auth.uid()). */
export function useMyEmailAccountIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["inbox", "my-email-accounts", user?.id ?? "anon"],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("email_accounts").select("id");
      if (error) throw error;
      return (data ?? []).map((a) => a.id as string);
    },
  });
}

/**
 * Assinaturas realtime de lista de conversas. E-mail: só threads das caixas do próprio
 * usuário (as demais visíveis por contato reconciliam ao focar/reconectar).
 */
export function useInboxListRealtime(
  channels: ChannelKind[],
  queryKeys: readonly (readonly unknown[])[],
) {
  const { user } = useAuth();
  const accounts = useMyEmailAccountIds();
  const emailFilter = emailAccountsFilter(accounts.data ?? []);
  const subs: RealtimeSubscription[] = [];
  const keys = queryKeys.map((k) => [...k]);
  if (channels.includes("email") && emailFilter)
    subs.push({ table: "email_threads", filter: emailFilter, queryKeys: keys });
  if (channels.includes("whatsapp"))
    subs.push({ table: "whatsapp_conversations", queryKeys: keys });
  if (channels.includes("chat")) subs.push({ table: "live_chat_sessions", queryKeys: keys });
  useRealtimeInvalidate(user?.id ? subs : [], { scope: `inbox:${user?.id ?? "anon"}` });
}

export function useInboxChannelPage<Row extends { id: string }>(
  channel: ChannelKind,
  assignee: AssigneeFilter,
  search: string,
) {
  const { user } = useAuth();
  const listFn = useServerFn(listInboxChannelPage);
  const q = useInfiniteQuery({
    queryKey: channelPageKey(user?.id, channel, assignee, search),
    enabled: !!user?.id,
    initialPageParam: null as ChannelCursor | null,
    placeholderData: (prev) => prev,
    queryFn: async ({ pageParam, signal }): Promise<ChannelPage<Row>> => {
      const raw = await listFn({
        data: { channel, assignee, search: search.trim() || undefined, cursor: pageParam },
        signal,
      });
      return parseChannelPage<Row>(raw);
    },
    getNextPageParam: (last: ChannelPage<Row>) => (last.hasMore ? last.nextCursor : undefined),
  });
  useInboxListRealtime([channel], [["inbox-channel", channel, user?.id ?? "anon"]]);
  const rows = useMemo(() => mergeChannelPages(q.data?.pages ?? []), [q.data]);
  const first = q.data?.pages[0];
  return { rows, counts: first?.counts ?? null, total: first?.total ?? null, query: q };
}
