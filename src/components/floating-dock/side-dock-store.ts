// Estado compartilhado da aba lateral (Mensagens, IA, Chamado).
// Os gatilhos publicam disponibilidade/contadores e escutam pedidos de abertura.
import { useSyncExternalStore } from "react";

export type DockItem = "chat" | "agent" | "bug";

type DockState = { chatAllowed: boolean; chatUnread: number; agentAvailable: boolean };

let state: DockState = { chatAllowed: false, chatUnread: 0, agentAvailable: false };
const listeners = new Set<() => void>();
const openers = new Map<DockItem, () => void>();

export function setDockState(patch: Partial<DockState>) {
  const next = { ...state, ...patch };
  if (
    next.chatAllowed === state.chatAllowed &&
    next.chatUnread === state.chatUnread &&
    next.agentAvailable === state.agentAvailable
  )
    return;
  state = next;
  listeners.forEach((l) => l());
}

export function useDockState(): DockState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

export function registerDockOpener(item: DockItem, fn: () => void) {
  openers.set(item, fn);
  return () => {
    if (openers.get(item) === fn) openers.delete(item);
  };
}

export function openDockItem(item: DockItem) {
  openers.get(item)?.();
}

export const MESSENGER_PERMISSION = "system.messenger.view.own";

/** Mensagens só aparecem na aba com a permissão efetiva carregada (nega por padrão). */
export function messengerAllowed(p: {
  isLoading: boolean;
  isError: boolean;
  can: (key: string) => boolean;
}): boolean {
  return !p.isLoading && !p.isError && p.can(MESSENGER_PERMISSION);
}
