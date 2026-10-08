import { describe, expect, it, vi } from "vitest";
import {
  approverProblem,
  computeEligibility,
  dispatchDeliveries,
  divergenceFrom,
  modalityFor,
  staffingKindOf,
  suggestionFromLine,
  type Delivery,
  type PrefillLine,
} from "./eligibility";

const line = (o: Partial<PrefillLine> = {}): PrefillLine => ({
  id: "l1",
  name: "Item",
  quantity: 2,
  seniority: null,
  service_catalog_id: "s1",
  catalogName: "Outsourcing de TI",
  contracting_preset_id: null,
  job_profile_id: "jp1",
  preset: null,
  jobProfile: { name: "Desenvolvedor Delphi", seniority: "Sênior" },
  ...o,
});

describe("elegibilidade", () => {
  it("normaliza caixa e acentos", () => {
    expect(staffingKindOf("HÜNTING Executivo")).toBe("hunting");
    expect(staffingKindOf("outsourcing")).toBe("outsourcing");
    expect(staffingKindOf("Consultoria")).toBeNull();
  });
  it("usa só associação ao catálogo, não texto do item", () => {
    expect(computeEligibility([{ service_catalog_id: null, catalogName: "Hunting" }]).eligible).toBe(false);
    expect(computeEligibility([{ service_catalog_id: "x", catalogName: "Hunting" }]).eligible).toBe(true);
  });
  it("modalidade padrão conforme serviços", () => {
    expect(modalityFor(["hunting", "outsourcing"])).toBe("both");
    expect(modalityFor(["hunting"])).toBe("hunting");
  });
});

describe("pré-preenchimento pelos itens de linha", () => {
  it("2 Delphi Sênior + 3 React Pleno = 2 perfis e 5 posições", () => {
    const s = [
      line(),
      line({ id: "l2", quantity: 3, jobProfile: { name: "Desenvolvedor React", seniority: "Pleno" } }),
    ].map(suggestionFromLine);
    expect(s).toHaveLength(2);
    expect(s.reduce((a, x) => a + x!.quantity, 0)).toBe(5);
  });
  it("valor explícito do item vence o padrão do preset/cargo", () => {
    const s = suggestionFromLine(
      line({ seniority: "Pleno", preset: { name: "P", seniority: "Sênior", job_profile_id: "jp1" } }),
    )!;
    expect(s.seniority).toBe("pleno");
    expect(s.origin.seniority).toBe("Item de linha");
  });
  it("aponta lacunas e ignora itens sem cargo/preset ou fora de Hunting/Outsourcing", () => {
    expect(suggestionFromLine(line({ jobProfile: { name: "X", seniority: null } }))!.gaps).toContain("Senioridade");
    expect(suggestionFromLine(line({ job_profile_id: null, jobProfile: null }))).toBeNull();
    expect(suggestionFromLine(line({ catalogName: "Licença" }))).toBeNull();
  });
  it("divergência é só informada", () => {
    const s = suggestionFromLine(line())!;
    expect(divergenceFrom({ title: "Outro", quantity: 2, seniority: "senior" }, s)).toEqual(["Título"]);
  });
});

describe("aprovador", () => {
  it("bloqueia ausente ou ambíguo com mensagem de correção", () => {
    expect(approverProblem({ status: "ok" })).toBeNull();
    expect(approverProblem({ status: "no_leader" })).toMatch(/líder/);
    expect(approverProblem({ status: "ambiguous" })).toMatch(/mais de um/);
  });
});

describe("despacho de avisos", () => {
  const base = (o: Partial<Delivery>): Delivery => ({
    id: "d",
    channel: "email",
    recipient_id: "u",
    status: "pending",
    attempts: 0,
    ...o,
  });
  const deps = () => ({
    claim: vi.fn(async () => true),
    sendEmail: vi.fn(async () => "sent" as const),
    sendNotification: vi.fn(async () => {}),
    finish: vi.fn(async () => {}),
  });
  it("não reenvia o que já foi enviado", async () => {
    const d = deps();
    await dispatchDeliveries([base({ status: "sent" }), base({ id: "n", channel: "notification", status: "sent" })], d);
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.sendNotification).not.toHaveBeenCalled();
  });
  it("falha do provedor fica registrada e pode ser retentada", async () => {
    const d = deps();
    d.sendEmail.mockRejectedValueOnce(new Error("provedor fora"));
    const r = await dispatchDeliveries([base({})], d);
    expect(r[0]).toMatchObject({ status: "failed", error: "provedor fora" });
    expect(d.finish).toHaveBeenCalledWith(expect.anything(), { status: "failed", error: "provedor fora" });
    const r2 = await dispatchDeliveries([base({ status: "failed", attempts: 1 })], d);
    expect(r2[0]!.status).toBe("sent");
  });
  it("concorrência: quem não consegue reservar não envia", async () => {
    const d = deps();
    d.claim.mockResolvedValue(false);
    await dispatchDeliveries([base({})], d);
    expect(d.sendEmail).not.toHaveBeenCalled();
  });
  it("respeita limite de tentativas", async () => {
    const d = deps();
    await dispatchDeliveries([base({ status: "failed", attempts: 5 })], d);
    expect(d.claim).not.toHaveBeenCalled();
  });
});
