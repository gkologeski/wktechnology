/**
 * Regra pura de arquivamento de números/contas de atendimento.
 * Conectado = presente no conjunto ativo. Desconhecido (provedor indisponível) preserva o estado atual.
 */
export type ArchiveDecision = { archived: boolean };

export function decideArchive(input: {
  sourceKey: string;
  active: ReadonlySet<string>;
  /** false quando não foi possível confirmar a situação no provedor. */
  confirmed: boolean;
  currentArchivedAt: string | null | undefined;
  /** true quando a conta ainda não existe na lista. */
  isNew: boolean;
}): ArchiveDecision {
  if (input.active.has(input.sourceKey)) return { archived: false };
  if (input.confirmed) return { archived: true };
  if (input.isNew) return { archived: true };
  return { archived: input.currentArchivedAt != null };
}
