// Mostra e alterna quem atende a conversa de WhatsApp: agente SDR ou pessoa.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getConversationAiOwner, setConversationAiOwner } from "@/lib/sdr-agent.functions";

export function ConversationAiOwnerToggle({ conversationId }: { conversationId: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getConversationAiOwner);
  const setFn = useServerFn(setConversationAiOwner);
  const key = ["wa-ai-owner", conversationId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => getFn({ data: { conversation_id: conversationId } }),
    staleTime: 10_000,
  });
  const mut = useMutation({
    mutationFn: (owner: "ai" | "human") =>
      setFn({ data: { conversation_id: conversationId, owner } }),
    onSuccess: (r) => {
      qc.setQueryData(key, { owner: r.owner, canSupervise: true });
      toast.success(
        r.owner === "ai" ? "Conversa devolvida ao agente." : "Atendimento humano ativado.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (q.isLoading || q.isError || !q.data) return null;
  const isAi = q.data.owner === "ai";
  const disabled = !q.data.canSupervise || mut.isPending;
  return (
    <Button
      size="sm"
      variant={isAi ? "secondary" : "outline"}
      disabled={disabled}
      title={
        q.data.canSupervise ? undefined : "Você não tem permissão para supervisionar o agente SDR."
      }
      aria-label={
        isAi
          ? "Atendido pelo agente. Assumir atendimento"
          : "Atendimento humano. Devolver ao agente"
      }
      onClick={() => mut.mutate(isAi ? "human" : "ai")}
    >
      {isAi ? (
        <>
          <Bot className="mr-1 h-3 w-3" /> Agente atendendo · Assumir
        </>
      ) : (
        <>
          <UserRound className="mr-1 h-3 w-3" /> Humano atendendo · Devolver ao agente
        </>
      )}
    </Button>
  );
}
