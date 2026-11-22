import { useRef } from "react";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { createMessageSendAttempt } from "@/lib/message-send-attempt";

/** A failed call retains the same attempt. Confirmed acceptance permits a new
 * composition, even with identical content. No provider or account authority. */
function useMessageSendAttempt(channel: "email" | "chat") {
  const { user } = useAuth();
  const { workspaceId, canAny } = usePermissions();
  const keys =
    channel === "email"
      ? [
          "techsales.inbox.email.create.own",
          "techsales.inbox.email.create.team",
          "techsales.inbox.email.create.workspace",
        ]
      : ["techsales.inbox.chat.create.own", "techsales.inbox.chat.create.workspace"];
  const canSend = !!user && !!workspaceId && canAny(keys);
  const attempt = useRef(createMessageSendAttempt()).current;
  return {
    canSend,
    prepare<T extends Record<string, unknown>>(data: T) {
      if (!canSend) throw new Error("Você não tem permissão para enviar neste canal e workspace.");
      return attempt.prepare([user?.id, workspaceId, channel], data);
    },
    complete: attempt.complete,
  };
}

export function useEmailSendAttempt() {
  return useMessageSendAttempt("email");
}
export function useChatSendAttempt() {
  return useMessageSendAttempt("chat");
}
