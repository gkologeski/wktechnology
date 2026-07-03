// Hook genérico: escuta postgres_changes em uma ou mais tabelas e invalida
// as query keys correspondentes no react-query, para que criações/edições
// feitas por outros usuários (ou por webhooks/automações) apareçam na tela
// sem precisar dar refresh.
//
// Padrão baseado em src/hooks/use-chat-realtime.ts.
import { useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RealtimeSubscription = {
  /** Nome da tabela em public.* */
  table: string;
  /** Evento a escutar. Default: '*' (INSERT|UPDATE|DELETE). */
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  /** Query keys a invalidar no react-query quando o evento chegar. */
  queryKeys?: QueryKey[];
  /** Callback opcional executado quando o evento chegar (para páginas sem react-query). */
  onChange?: () => void;
};

/**
 * Assina realtime para uma lista de tabelas e invalida queries automaticamente.
 * Todas as inscrições passadas no mesmo array compartilham UM canal para
 * economizar conexões WebSocket. O canal é fechado quando a aba fica oculta
 * (visibilitychange) e no unmount.
 */
export function useRealtimeInvalidate(
  subs: RealtimeSubscription[],
  opts?: { channelName?: string },
) {
  const qc = useQueryClient();
  // Guardamos a versão mais recente em ref pra não recriar o canal a cada render.
  const subsRef = useRef(subs);
  subsRef.current = subs;

  // Chave estável baseada nas tabelas — evita reassinar quando só as queryKeys mudam.
  const tablesKey = subs.map((s) => `${s.table}:${s.event ?? "*"}`).join("|");
  const channelName = opts?.channelName ?? `rt:${tablesKey}`;

  useEffect(() => {
    if (typeof window === "undefined") return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const subscribe = () => {
      if (channel) return;
      let c = supabase.channel(channelName);
      for (const sub of subsRef.current) {
        c = c.on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "postgres_changes" as any,
          { event: sub.event ?? "*", schema: "public", table: sub.table },
          () => {
            const current = subsRef.current.find((s) => s.table === sub.table);
            if (!current) return;
            for (const key of current.queryKeys ?? []) {
              qc.invalidateQueries({ queryKey: key });
            }
            current.onChange?.();
          },
        );
      }
      channel = c.subscribe();
    };

    const unsubscribe = () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) unsubscribe();
      else subscribe();
    };

    if (typeof document === "undefined" || !document.hidden) subscribe();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      unsubscribe();
    };
    // channelName encapsula tablesKey; qc é estável.
  }, [channelName, qc]);
}
