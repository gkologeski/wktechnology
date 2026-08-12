// Indica se existe rascunho salvo para uma composição (sem carregar o conteúdo).
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { hasMessageDrafts } from "@/lib/message-drafts.functions";
import { draftScopeKey, type DraftScopeInput } from "@/lib/message-drafts/scope";

export function messageDraftExistsKey(channel: string, scopeKey: string) {
  return ["message_draft_exists", channel, scopeKey] as const;
}

export function useHasMessageDraft(options: { scope: DraftScopeInput; enabled?: boolean }) {
  const { scope, enabled = true } = options;
  const scopeKey = draftScopeKey(scope);
  const check = useServerFn(hasMessageDrafts);

  const q = useQuery({
    queryKey: messageDraftExistsKey(scope.channel, scopeKey),
    queryFn: async () => {
      const res = await check({ data: { channel: scope.channel, scope_keys: [scopeKey] } });
      return res.scope_keys.includes(scopeKey);
    },
    enabled,
    staleTime: 30_000,
  });

  return Boolean(q.data);
}
