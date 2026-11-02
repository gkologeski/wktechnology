// Regra de exibição da opção Mensagens na aba lateral.
export const MESSENGER_PERMISSION = "system.messenger.view.own";

/** Mensagens só aparecem na aba com a permissão efetiva carregada (nega por padrão). */
export function messengerAllowed(p: {
  isLoading: boolean;
  isError: boolean;
  can: (key: string) => boolean;
}): boolean {
  return !p.isLoading && !p.isError && p.can(MESSENGER_PERMISSION);
}
