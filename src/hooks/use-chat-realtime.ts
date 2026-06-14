// Hook de realtime do chat: invalida queries e dispara toast em mensagens novas.
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { playMessageSound } from "@/lib/chat-sound";

type Opts = {
  /** ID da conversa atualmente aberta (suprime toast pra mensagens dela). */
  activeConversationId: string | null;
  /** Resolve o nome de exibição do remetente. */
  resolveSender?: (userId: string) => string;
};

export function useChatRealtime({ activeConversationId, resolveSender }: Opts) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const activeRef = useRef(activeConversationId);
  activeRef.current = activeConversationId;
  const resolveRef = useRef(resolveSender);
  resolveRef.current = resolveSender;

  useEffect(() => {
    if (!user?.id) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const subscribe = () => {
      if (channel) return;
      channel = supabase
        .channel("chat-stream")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages" },
          (payload) => {
            const row = payload.new as {
              id: string;
              conversation_id: string;
              sender_user_id: string;
              body: string | null;
              created_at: string;
            };
            qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
            qc.invalidateQueries({ queryKey: ["chat", "messages", row.conversation_id] });
            if (row.sender_user_id === user.id) return;
            if (activeRef.current === row.conversation_id) return;
            playMessageSound();
            const who = resolveRef.current
              ? resolveRef.current(row.sender_user_id)
              : "Nova mensagem";
            toast(who, {
              description: row.body?.slice(0, 140) ?? "(anexo)",
            });
          },
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations" }, () =>
          qc.invalidateQueries({ queryKey: ["chat", "conversations"] }),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "chat_conversation_members" },
          () => qc.invalidateQueries({ queryKey: ["chat", "conversations"] }),
        )
        .subscribe();
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
  }, [qc, user?.id]);
}
