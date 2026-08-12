// Autosave de rascunho de mensagem no servidor, com debounce e restauração.
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  getMessageDraft,
  saveMessageDraft,
  deleteMessageDraft,
  type MessageDraftAttachment,
} from "@/lib/message-drafts.functions";
import { draftContext, draftScopeKey, type DraftScopeInput } from "@/lib/message-drafts/scope";
import { messageDraftExistsKey } from "@/hooks/use-has-message-draft";

export type DraftValue = {
  to_addr?: string;
  cc?: string;
  subject?: string;
  body_html?: string;
  body_text?: string;
  attachments?: MessageDraftAttachment[];
};

export type DraftStatus = "idle" | "loading" | "saving" | "saved";

const DEBOUNCE_MS = 800;

export function useMessageDraft(options: {
  scope: DraftScopeInput;
  enabled: boolean;
  value: DraftValue;
  onRestore: (draft: Required<DraftValue>) => void;
}) {
  const { scope, enabled, value, onRestore } = options;
  const scopeKey = draftScopeKey(scope);
  const channel = scope.channel;

  const load = useServerFn(getMessageDraft);
  const save = useServerFn(saveMessageDraft);
  const remove = useServerFn(deleteMessageDraft);
  const qc = useQueryClient();
  const setExists = useCallback(
    (exists: boolean) => {
      qc.setQueryData(messageDraftExistsKey(channel, scopeKey), exists);
    },
    [qc, channel, scopeKey],
  );

  const [status, setStatus] = useState<DraftStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const hydratedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPayloadRef = useRef<string>("");
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;
  const valueRef = useRef(value);
  valueRef.current = value;

  // Carrega o rascunho ao abrir/trocar de composição.
  useEffect(() => {
    hydratedRef.current = false;
    lastPayloadRef.current = "";
    setRestored(false);
    setSavedAt(null);
    setStatus("idle");
    if (!enabled) return;
    let cancelled = false;
    setStatus("loading");
    load({ data: { channel, scope_key: scopeKey } })
      .then((draft) => {
        if (cancelled) return;
        if (draft) {
          onRestoreRef.current({
            to_addr: draft.to_addr,
            cc: draft.cc,
            subject: draft.subject,
            body_html: draft.body_html,
            body_text: draft.body_text,
            attachments: draft.attachments,
          });
          setSavedAt(draft.updated_at);
          setRestored(true);
          setStatus("saved");
        } else {
          setStatus("idle");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("idle");
      })
      .finally(() => {
        // Marca hidratado no próximo tick para não salvar o valor restaurado.
        setTimeout(() => {
          if (!cancelled) hydratedRef.current = true;
        }, 0);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, channel, scopeKey]);

  // Autosave com debounce.
  useEffect(() => {
    if (!enabled || !hydratedRef.current) return;
    const payload = {
      channel,
      scope_key: scopeKey,
      to_addr: value.to_addr ?? "",
      cc: value.cc ?? "",
      subject: value.subject ?? "",
      body_html: value.body_html ?? "",
      body_text: value.body_text ?? "",
      attachments: value.attachments ?? [],
      context: draftContext(scope),
    };
    const serialized = JSON.stringify(payload);
    if (serialized === lastPayloadRef.current) return;
    lastPayloadRef.current = serialized;
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus("saving");
    timerRef.current = setTimeout(() => {
      save({ data: payload })
        .then((res) => {
          setStatus(res.saved ? "saved" : "idle");
          setSavedAt(res.updated_at ?? null);
          setExists(res.saved);
        })
        .catch(() => setStatus("idle"));
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    channel,
    scopeKey,
    value.to_addr,
    value.cc,
    value.subject,
    value.body_html,
    value.body_text,
    value.attachments,
  ]);

  const discard = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    lastPayloadRef.current = "";
    setStatus("idle");
    setSavedAt(null);
    setRestored(false);
    setExists(false);
    await remove({ data: { channel, scope_key: scopeKey } }).catch(() => {});
  }, [remove, channel, scopeKey, setExists]);

  const clearAfterSend = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    lastPayloadRef.current = "";
    hydratedRef.current = false;
    setStatus("idle");
    setSavedAt(null);
    setRestored(false);
    setExists(false);
    void remove({ data: { channel, scope_key: scopeKey } }).catch(() => {});
  }, [remove, channel, scopeKey, setExists]);

  return { status, savedAt, restored, discard, clearAfterSend };
}
