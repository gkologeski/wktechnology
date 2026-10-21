import { describe, expect, it } from "vitest";
import { assertInboxAssigned, INBOX_ASSIGN_DENIED } from "./inbox-assignment.shared";

describe("assertInboxAssigned", () => {
  it("aceita quando a atribuição foi gravada", () => {
    expect(() => assertInboxAssigned(true)).not.toThrow();
  });
  it("avisa falta de permissão quando nada foi alterado", () => {
    expect(() => assertInboxAssigned(false)).toThrow(INBOX_ASSIGN_DENIED);
    expect(() => assertInboxAssigned(null)).toThrow(INBOX_ASSIGN_DENIED);
  });
});
