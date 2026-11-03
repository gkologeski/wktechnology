// Selo "número bloqueado pela Meta" na ficha de Contato/Lead, com liberação manual.
import { MessageCircleOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { formatPhoneDisplay } from "@/lib/phone/e164";
import { SUPPRESSION_LABEL } from "@/lib/whatsapp/whatsapp-suppression";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  getRecordWhatsAppSuppressions,
  getWhatsAppSuppressionStats,
  releaseWhatsAppSuppression,
} from "@/lib/whatsapp/whatsapp-suppressions.functions";

const RELEASE_KEY = "system.whatsapp_suppressions.manage.workspace";

/** Totais de números bloqueados no workspace (sem telefones), para avisos de planejamento. */
export function useWhatsAppSuppressionStats(workspaceId: string | null | undefined) {
  const load = useServerFn(getWhatsAppSuppressionStats);
  return useQuery({
    queryKey: ["whatsapp-suppression-stats", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => load({ data: { workspaceId: workspaceId! } }),
    staleTime: 5 * 60_000,
  });
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function WhatsAppSuppressionNotice({
  entity,
  id,
}: {
  entity: "contact" | "lead";
  id: string;
}) {
  const permissions = usePermissions();
  const load = useServerFn(getRecordWhatsAppSuppressions);
  const releaseFn = useServerFn(releaseWhatsAppSuppression);
  const qc = useQueryClient();
  const queryKey = ["whatsapp-suppressions", entity, id] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => load({ data: { entity, id } }),
    staleTime: 60_000,
  });
  const release = useMutation({
    mutationFn: (suppressionId: string) => releaseFn({ data: { id: suppressionId } }),
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });
  // Botão só com a chave efetiva na tela E confirmação do servidor; a RPC revalida no banco.
  const canRelease =
    !!query.data?.canRelease &&
    !permissions.isLoading &&
    !permissions.isError &&
    permissions.canAny([RELEASE_KEY]);
  const items = query.data?.items ?? [];
  if (query.isError) {
    return (
      <p className="mb-3 text-xs text-muted-foreground" role="status">
        Não foi possível verificar bloqueios de WhatsApp deste cadastro.
      </p>
    );
  }
  if (!items.length) return null;

  const onRelease = async (suppressionId: string, phone: string) => {
    const ok = await confirmDialog({
      title: "Liberar número para WhatsApp?",
      description: `${formatPhoneDisplay(phone)} voltará a receber campanhas e sequências. Se a Meta recusar de novo, ele será bloqueado outra vez.`,
      confirmLabel: "Liberar número",
    });
    if (!ok) return;
    release.mutate(suppressionId, {
      onSuccess: () => toast.success("Número liberado para WhatsApp."),
      onError: (e) => toast.error((e as Error).message || "Não foi possível liberar o número."),
    });
  };

  return (
    <section
      aria-label="Bloqueios de WhatsApp"
      className="mb-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm"
    >
      <div className="flex items-center gap-2 font-medium text-foreground">
        <MessageCircleOff className="h-4 w-4 text-warning" aria-hidden />
        WhatsApp bloqueado pela Meta
      </div>
      <ul className="mt-2 space-y-2">
        {items.map((it) => (
          <li key={it.id} className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{formatPhoneDisplay(it.phone)}</span>
              {" — "}
              {SUPPRESSION_LABEL[it.reason]}. Bloqueado até {dateFmt.format(new Date(it.expiresAt))}
              .
            </div>
            {canRelease ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                disabled={release.isPending}
                onClick={() => void onRelease(it.id, it.phone)}
              >
                Liberar número
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Campanhas e sequências pulam este número e tentam o próximo celular do cadastro.
      </p>
    </section>
  );
}
