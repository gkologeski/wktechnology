/** Regras puras de escolha da agenda usada ao marcar reunião (plano DESLIGA-AGENDA). */
export type MeetingCalendarAccount = {
  id: string;
  email: string | null;
  owner_id: string | null;
  sync_enabled: boolean;
  last_status: string | null;
  owner_active?: boolean;
};

const UNUSABLE_STATUS = new Set(["disconnected", "error", "revoked"]);

/** Conta utilizável: sincronização ligada, sem erro/desconexão e dono ativo. */
export function isUsableCalendarAccount(a: MeetingCalendarAccount): boolean {
  if (!a.sync_enabled) return false;
  if (a.last_status && UNUSABLE_STATUS.has(a.last_status)) return false;
  if (a.owner_active === false) return false;
  return true;
}

/** Contas que o usuário pode escolher: as próprias; admin vê todas do workspace. */
export function selectableCalendarAccounts(
  items: MeetingCalendarAccount[],
  userId: string,
  isAdmin: boolean,
): MeetingCalendarAccount[] {
  return items.filter(
    (a) => isUsableCalendarAccount(a) && (isAdmin || a.owner_id === userId),
  );
}

/** Padrão: a conta do próprio usuário; nunca a mais recente de outra pessoa. */
export function defaultMeetingCalendarAccount(
  items: MeetingCalendarAccount[],
  userId: string,
): string | null {
  return items.find((a) => isUsableCalendarAccount(a) && a.owner_id === userId)?.id ?? null;
}

/** Erro do Google que indica conta removida/acesso revogado (não adianta tentar de novo). */
export function isGoogleAccountGone(body: string): boolean {
  return /invalid_grant|account has been deleted|token has been expired or revoked/i.test(body);
}
