// Hook genérico: escuta postgres_changes em uma ou mais tabelas e invalida
// as query keys correspondentes no react-query, para que criações/edições
// feitas por outros usuários (ou por webhooks/automações) apareçam na tela
// sem precisar dar refresh.
//
// - `filter` restringe o canal ao registro (ex.: `id=eq.<uuid>`); eventos de
//   outros registros não recarregam a tela. A RLS continua sendo a fronteira de
//   segurança — o filtro só reduz recargas.
// - Eventos são agrupados (250 ms de silêncio, no máximo 1 s de espera).
// - Ao (re)conectar depois de uma queda ou de a aba voltar a ficar visível,
//   todas as chaves são recarregadas uma vez para não perder mudanças.
import { useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  buildChannelName,
  createInvalidationBatcher,
  payloadMatchesFilter,
  type RealtimeEvent,
} from "@/lib/realtime/invalidation-batcher";

export type RealtimeSubscription = {
  /** Nome da tabela em public.* */
  table: string;
  /** Evento a escutar. Default: '*' (INSERT|UPDATE|DELETE). */
  event?: RealtimeEvent;
  /** Filtro Postgres Changes (`coluna=eq.valor` ou `coluna=in.(a,b)`). */
  filter?: string;
  /** Query keys a invalidar no react-query quando o evento chegar. */
  queryKeys?: QueryKey[];
  /** Callback opcional executado quando o evento chegar (para páginas sem react-query). */
  onChange?: () => void;
};

export function useRealtimeInvalidate(
  subs: RealtimeSubscription[],
  opts?: { channelName?: string; scope?: string | null },
) {
  const qc = useQueryClient();
  const subsRef = useRef(subs);
  subsRef.current = subs;

  const channelName = opts?.channelName ?? buildChannelName(subs, opts?.scope);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let everSubscribed = false;
    let disposed = false;

    const batcher = createInvalidationBatcher((keys, callbacks) => {
      if (disposed) return;
      for (const key of keys) void qc.invalidateQueries({ queryKey: key });
      for (const cb of callbacks) cb();
    });

    const reconcileAll = () => {
      const all = subsRef.current;
      batcher.push(
        all.flatMap((s) => s.queryKeys ?? []),
        all.flatMap((s) => (s.onChange ? [s.onChange] : [])),
      );
    };

    const subscribe = () => {
      if (channel || disposed) return;
      let c = supabase.channel(channelName);
      subsRef.current.forEach((sub, index) => {
        const params: Record<string, string> = {
          event: sub.event ?? "*",
          schema: "public",
          table: sub.table,
        };
        if (sub.filter) params.filter = sub.filter;
        c = c.on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "postgres_changes" as any,
          params,
          (payload: {
            eventType?: string;
            new?: Record<string, unknown>;
            old?: Record<string, unknown>;
          }) => {
            const current = subsRef.current[index];
            if (!current || current.table !== sub.table) return;
            if (!payloadMatchesFilter(current.filter, payload)) return;
            batcher.push(current.queryKeys ?? [], current.onChange ? [current.onChange] : []);
          },
        );
      });
      channel = c.subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        // Reconexão (queda de rede ou aba que voltou): eventos no intervalo
        // não chegam pelo canal, então recarrega uma vez.
        if (everSubscribed) reconcileAll();
        everSubscribed = true;
      });
    };

    const unsubscribe = () => {
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) unsubscribe();
      else subscribe();
    };

    if (!document.hidden) subscribe();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      batcher.cancel();
      unsubscribe();
    };
    // channelName encapsula escopo/tabelas/eventos/filtros; qc é estável.
  }, [channelName, qc]);
}
