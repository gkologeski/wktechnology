import { expect, it } from "vitest";
import { cohortCandidates, enrollmentInput } from "./enrollment";
import { newDefinition } from "./draft";
import type { AudienceRow } from "@/lib/whatsapp/campaign-audience";
const row = (
  id: string,
  email: string,
  phones: (string | null)[] = [null, null, null],
): AudienceRow => ({
  sourceType: "contact",
  sourceId: id,
  contactId: id,
  phone: phones.find(Boolean) ?? null,
  phones,
  label: "Pessoa sintética",
  values: { "contact.email": email },
});
it("enrollment uses international email validation and preserves canonical mailbox", () => {
  const candidate = cohortCandidates([row("a", "Pessoa@例え.jp")], newDefinition())[0];
  expect(candidate.email).toBe("Pessoa@xn--r8jz45g.jp");
  expect(candidate.email_aliases).toContain("pessoa@xn--r8jz45g.jp");
  expect(candidate.channels.email).toBe(true);
});
it("enrollment never invents a country or repairs a legacy phone", () => {
  const definition = newDefinition();
  const a = cohortCandidates([row("a", "inválido", ["48991104003", null, null])], definition)[0];
  expect(a.phones).toEqual([]);
  expect(a.channels.whatsapp).toBe(false);
  expect(a.channels.call).toBe(false);
  const b = cohortCandidates([row("b", "", ["+5548991104003", null, null])], definition)[0];
  expect(b.channels.whatsapp).toBe(true);
  expect(b.channels.call).toBe(true);
});
it("enrollment checks channels independently and orders source records deterministically", () => {
  const definition = newDefinition();
  const [a, b] = cohortCandidates(
    [row("b", "b@example.invalid"), row("a", "a@example.invalid")],
    definition,
  );
  expect(a.id).toBe("a");
  expect(b.id).toBe("b");
  expect(a.channels.email).toBe(true);
  expect(a.channels.whatsapp).toBe(false);
});
it("enrollment input cannot accept actor, destinations or a caller definition", () => {
  const valid = {
    workspaceId: crypto.randomUUID(),
    versionId: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    consentEvidence: "Autorização registrada no atendimento.",
  };
  expect(enrollmentInput.safeParse(valid).success).toBe(true);
  for (const extra of [
    { actor: crypto.randomUUID() },
    { candidates: [] },
    { definition: newDefinition() },
  ])
    expect(enrollmentInput.safeParse({ ...valid, ...extra }).success).toBe(false);
  expect(enrollmentInput.safeParse({ ...valid, consentEvidence: "ok" }).success).toBe(false);
});
