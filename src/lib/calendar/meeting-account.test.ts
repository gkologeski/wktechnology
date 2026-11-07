import { describe, expect, it } from "vitest";
import {
  defaultMeetingCalendarAccount,
  isGoogleAccountGone,
  selectableCalendarAccounts,
  type MeetingCalendarAccount,
} from "./meeting-account";

const me = "user-me";
const accounts: MeetingCalendarAccount[] = [
  // mais recente, de outra pessoa (caso Cristiane): nunca deve ser o padrão
  { id: "cris", email: "c@x", owner_id: "cris", sync_enabled: true, last_status: "disconnected" },
  { id: "other", email: "o@x", owner_id: "other", sync_enabled: true, last_status: "connected" },
  { id: "mine", email: "m@x", owner_id: me, sync_enabled: true, last_status: "connected" },
];

describe("agenda da reunião", () => {
  it("padrão é a conta do usuário logado, não a mais recente", () => {
    expect(defaultMeetingCalendarAccount(accounts, me)).toBe("mine");
  });
  it("sem conta própria válida, não escolhe conta alheia", () => {
    expect(defaultMeetingCalendarAccount(accounts.slice(0, 2), me)).toBeNull();
  });
  it("não admin só vê a própria conta", () => {
    expect(selectableCalendarAccounts(accounts, me, false).map((a) => a.id)).toEqual(["mine"]);
  });
  it("admin vê contas válidas do workspace, sem desconectadas", () => {
    expect(selectableCalendarAccounts(accounts, me, true).map((a) => a.id)).toEqual(["other", "mine"]);
  });
  it("conta de membro inativo fica fora", () => {
    const list = [{ ...accounts[1], owner_active: false }];
    expect(selectableCalendarAccounts(list, me, true)).toEqual([]);
  });
  it("reconhece conta Google excluída", () => {
    expect(isGoogleAccountGone('{"error":"invalid_grant","error_description":"Account has been deleted"}')).toBe(true);
    expect(isGoogleAccountGone("rate limit")).toBe(false);
  });
});
