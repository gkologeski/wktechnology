// Disparo único do enriquecimento Apollo a partir do LinkedIn do lead.
//
// Regra: enriquecer somente quando a URL normalizada do LinkedIn realmente
// mudar para um valor válido. Salvar outros campos do lead nunca dispara o
// provedor (que é pago). O feedback ao usuário é um único toast por lead,
// atualizado de "reenriquecendo" para sucesso/aviso/erro.
import { useCallback } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { enrichLeadForQualification } from "@/lib/prospecting/qualification-enrichment.functions";
import { linkedinUrlOrNull, sameLinkedinUrl } from "@/lib/prospecting/linkedin-url";

/** Última URL efetivamente enviada ao provedor, por lead. */
const lastEnriched = new Map<string, string>();
/** Execuções em voo, por lead (evita chamadas concorrentes duplicadas). */
const inFlight = new Map<string, Promise<void>>();

/** Registra que o lead já foi enriquecido com esta URL (evita repetição). */
export function markLinkedinEnriched(leadId: string, url: string | null | undefined) {
  const normalized = linkedinUrlOrNull(url);
  if (normalized) lastEnriched.set(leadId, normalized);
}

/** URL já enriquecida para o lead, se conhecida nesta sessão. */
export function lastEnrichedLinkedin(leadId: string): string | null {
  return lastEnriched.get(leadId) ?? null;
}

export function useLinkedinEnrichment(leadId: string, onDone?: () => Promise<void> | void) {
  const enrichFn = useServerFn(enrichLeadForQualification);

  /**
   * Enriquece o lead se a URL for válida e diferente da última usada.
   * Devolve `true` quando o enriquecimento foi realmente disparado.
   */
  const enrichIfChanged = useCallback(
    async (url: string | null | undefined): Promise<boolean> => {
      const normalized = linkedinUrlOrNull(url);
      if (!normalized) return false;
      if (sameLinkedinUrl(lastEnriched.get(leadId) ?? null, normalized)) return false;
      if (inFlight.has(leadId)) {
        await inFlight.get(leadId);
        return false;
      }

      lastEnriched.set(leadId, normalized);
      const toastId = `linkedin-enrich-${leadId}`;
      toast.loading("LinkedIn atualizado — reenriquecendo o lead…", { id: toastId });

      const run = (async () => {
        try {
          const result = await enrichFn({
            data: { leadId, linkedinUrl: normalized, force: true },
          });
          await onDone?.();
          if (result.found) {
            toast.success("Lead reenriquecido a partir do novo LinkedIn.", { id: toastId });
          } else {
            toast.info(result.warnings[0] ?? "Nenhum dado novo encontrado para este LinkedIn.", {
              id: toastId,
            });
          }
        } catch (e) {
          // Enriquecimento é complementar: a edição do lead já foi salva.
          toast.error(e instanceof Error ? e.message : "Não foi possível reenriquecer o lead.", {
            id: toastId,
          });
        } finally {
          inFlight.delete(leadId);
        }
      })();

      inFlight.set(leadId, run);
      await run;
      return true;
    },
    [enrichFn, leadId, onDone],
  );

  return { enrichIfChanged };
}
