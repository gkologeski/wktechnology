// Contrato padrão para modais de entidade (create/edit/delete).
//
// Motivação: historicamente cada modal expunha um callback diferente
// (`onCreated`, `onUpdated`, `onSuccess`, `onSave`, …). Isso dificulta a
// integração com pais que precisam atualizar seu estado sem F5.
//
// A partir da Fase 3, todo modal de entidade deve aceitar `onSaved` como
// contrato canônico. Callbacks legados continuam funcionando por retro-
// compatibilidade e são disparados junto (ver `notifySaved`).
//
// Consumidores novos devem preferir `onSaved`, que entrega o `id` e a
// `action` (created/updated/deleted) da operação.
export type EntitySaveAction = "created" | "updated" | "deleted";

export type EntitySavedPayload<TExtra extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  action: EntitySaveAction;
} & TExtra;

export type EntityDialogProps<TExtra extends Record<string, unknown> = Record<string, unknown>> = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Chamado após save bem-sucedido. Preferido sobre `onCreated`/`onUpdated`. */
  onSaved?: (result: EntitySavedPayload<TExtra>) => void;
};

/**
 * Dispara `onSaved` (contrato canônico) e mantém compatibilidade com os
 * callbacks legados presentes no `handlers`.
 */
export function notifySaved<TExtra extends Record<string, unknown> = Record<string, unknown>>(
  handlers: {
    onSaved?: (r: EntitySavedPayload<TExtra>) => void;
    onCreated?: (id: string) => void;
    onUpdated?: (id: string) => void;
    onSuccess?: (id: string) => void;
  },
  result: { id: string } & TExtra,
  action: EntitySaveAction,
) {
  handlers.onSaved?.({ ...(result as EntitySavedPayload<TExtra>), action });
  if (action === "created") handlers.onCreated?.(result.id);
  if (action === "updated") handlers.onUpdated?.(result.id);
  handlers.onSuccess?.(result.id);
}
