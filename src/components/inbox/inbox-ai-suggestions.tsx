// Avisos da IA dentro da conversa (o cliente nunca vê) e link do material anexado.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getMessageMaterialLink,
  listConversationSuggestions,
  resolveSuggestion,
} from "@/lib/inbox/ai-assist.functions";
import { formatDateTime } from "@/lib/crm";

export type InboxSuggestion = Awaited<ReturnType<typeof listConversationSuggestions>>[number];
type Action = "dismiss" | "unlink" | "link_existing" | "create_and_link";

export function useConversationSuggestions(conversationId: string | null) {
  const listFn = useServerFn(listConversationSuggestions);
  return useQuery({
    queryKey: ["inbox-ai-suggestions", conversationId],
    enabled: !!conversationId,
    staleTime: 30_000,
    queryFn: () => listFn({ data: { conversationId: conversationId! } }),
  });
}

export function InboxAiSuggestionCard({
  s,
  personName,
}: {
  s: InboxSuggestion;
  personName: string;
}) {
  const qc = useQueryClient();
  const resolveFn = useServerFn(resolveSuggestion);
  const [confirm, setConfirm] = useState<{
    action: Action;
    companyId?: string;
    label: string;
  } | null>(null);
  const m = useMutation({
    mutationFn: (v: { action: Action; companyId?: string }) =>
      resolveFn({ data: { id: s.id, ...v } }),
    onSuccess: () => {
      toast.success("Sugestão aplicada.");
      void qc.invalidateQueries({ queryKey: ["inbox-ai-suggestions"] });
      void qc.invalidateQueries({ queryKey: ["inbox-identity-names"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const oldName = s.old_company_name ?? "a empresa atual";
  const entityPath = s.target_entity === "lead" ? "/leads/$id" : "/contacts/$id";
  return (
    <div
      role="note"
      aria-label="Sugestão da IA"
      className="mx-auto my-2 w-full max-w-[560px] rounded-md border border-ai-border bg-ai-surface p-3 text-xs text-text-primary"
    >
      <div className="mb-1 flex items-center gap-1.5 font-medium text-ai">
        <Bot className="h-3.5 w-3.5" aria-hidden /> Sugestão da IA
        <span className="font-normal text-muted-foreground">· só a equipe vê</span>
      </div>
      <p>
        {personName} informou que não trabalha mais na {oldName}.
        {s.new_company_name ? ` Nova empresa citada: ${s.new_company_name}.` : ""}
      </p>
      {s.status === "pending" ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {s.old_company_id || s.old_company_name ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={m.isPending}
              onClick={() => setConfirm({ action: "unlink", label: `Desassociar da ${oldName}` })}
            >
              Desassociar da {oldName}
            </Button>
          ) : null}
          {s.matches.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={m.isPending}
              onClick={() =>
                setConfirm({
                  action: "link_existing",
                  companyId: c.id,
                  label: `Trocar para ${c.name}`,
                })
              }
            >
              Trocar para {c.name}
            </Button>
          ))}
          {s.new_company_name && s.matches.length === 0 ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={m.isPending}
              onClick={() =>
                setConfirm({
                  action: "create_and_link",
                  label: `Criar ${s.new_company_name} e associar`,
                })
              }
            >
              Criar {s.new_company_name} e associar
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={m.isPending}
            onClick={() => m.mutate({ action: "dismiss" })}
          >
            Ignorar
          </Button>
          <Link
            to={entityPath}
            params={{ id: s.target_id }}
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            Abrir ficha
          </Link>
          {m.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Aplicando" />
          ) : null}
        </div>
      ) : (
        <p className="mt-1 text-muted-foreground">
          {s.status === "applied" ? "Aplicada" : "Ignorada"}
          {s.resolved_at ? ` em ${formatDateTime(s.resolved_at)}` : ""}.
        </p>
      )}
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              O cadastro de {personName} será alterado e a mudança fica registrada na linha do
              tempo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm) m.mutate({ action: confirm.action, companyId: confirm.companyId });
                setConfirm(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** "📎 Nome" de material enviado pela Lia: abre um link curto gerado na hora. */
export function SdrMaterialLink({ messageId, label }: { messageId: string; label: string }) {
  const linkFn = useServerFn(getMessageMaterialLink);
  const [state, setState] = useState<"idle" | "loading" | "missing">("idle");
  return (
    <button
      type="button"
      className="mt-1 inline-flex items-center gap-1.5 rounded border border-border bg-product-panel px-2 py-1 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      disabled={state === "loading"}
      onClick={async () => {
        setState("loading");
        // Abre a aba já no clique (evita bloqueio de pop-up) e aponta depois.
        const win = window.open("", "_blank");
        try {
          const { url } = await linkFn({ data: { messageId } });
          if (!url) {
            win?.close();
            setState("missing");
            return;
          }
          if (win) win.location.href = url;
          else window.location.href = url;
          setState("idle");
        } catch {
          win?.close();
          setState("idle");
          toast.error("Não foi possível abrir o material.");
        }
      }}
    >
      {state === "loading" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <FileText className="h-3.5 w-3.5" aria-hidden />
      )}
      {state === "missing" ? "Material indisponível" : label}
    </button>
  );
}
