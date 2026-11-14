import { it, expect, vi, beforeEach } from "vitest";
const m = vi.hoisted(() => ({ allowed: true }));
vi.mock("@/lib/access-control/enforce.server", () => ({
  assertAnyPermission: async () => {
    if (!m.allowed) throw new Error("denied");
  },
}));
import { resolveSignerContacts } from "./signer-contacts.server";
const a = "10000000-0000-4000-8000-000000000001",
  b = "10000000-0000-4000-8000-000000000002";
const list = [
  { role: "CONTRATANTE", contactId: a },
  { role: "CONTRATADO", contactId: b },
];
const rows = () => [
  { id: a, first_name: "Cliente", last_name: "Fixture", email: "cliente@example.test" },
  { id: b, first_name: "Emissor", last_name: "Fixture", email: "emissor@example.test" },
];
function client(data: unknown[]) {
  const q: any = {
    select: vi.fn(() => q),
    eq: vi.fn(() => q),
    is: vi.fn(() => q),
    in: vi.fn(async () => ({ data, error: null })),
  };
  return { from: vi.fn(() => q), q } as any;
}
beforeEach(() => (m.allowed = true));
it("resolves signer identities only from visible workspace contacts", async () => {
  const c = client(rows());
  const r = await resolveSignerContacts(c, "u", "w", list);
  expect(c.q.eq).toHaveBeenCalledWith("workspace_id", "w");
  expect(c.q.is).toHaveBeenCalledWith("deleted_at", null);
  expect(r[0].name).toBe("Cliente Fixture");
  expect(r[0].email).toBe("cliente@example.test");
});
it("denies contact resolution before querying without contact permission", async () => {
  m.allowed = false;
  const c = client(rows());
  await expect(resolveSignerContacts(c, "u", "w", list)).rejects.toThrow("denied");
  expect(c.from).not.toHaveBeenCalled();
});
it("does not substitute missing or inaccessible contacts", async () => {
  await expect(resolveSignerContacts(client(rows().slice(0, 1)), "u", "w", list)).rejects.toThrow(
    "não está mais disponível",
  );
});
it("rejects invalid stored emails and duplicate signer emails", async () => {
  const invalid = rows();
  invalid[0].email = "not-email";
  await expect(resolveSignerContacts(client(invalid), "u", "w", list)).rejects.toThrow();
  const same = rows();
  same[1].email = same[0].email;
  await expect(resolveSignerContacts(client(same), "u", "w", list)).rejects.toThrow("distintos");
});
