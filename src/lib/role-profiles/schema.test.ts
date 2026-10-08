import { describe, expect, it } from "vitest";
import {
  ProfileDataZ,
  applyClientProposal,
  approvalMissing,
  completeness,
  diffProfiles,
  emptyData,
  marginPct,
  sanitizeAllowedFields,
  toAtsJob,
  toClientView,
  toTemplatePayload,
  type ProfileLike,
} from "./schema";
import { normalizeImportedProfile } from "./import";

function full(over: Partial<ProfileLike> = {}): ProfileLike {
  const data = ProfileDataZ.parse({
    role: { responsibilities: "Manter ERP em Delphi", project_context: "Migração" },
    requirements: {
      skills: [
        { name: "Delphi", kind: "required", years: 5 },
        { name: "Firebird", kind: "desired" },
      ],
      languages: [],
      certifications: [],
    },
    conditions: { work_mode: "remote", schedule: "40h" },
    outsourcing: { allocation_months: 12, dedication: "full" },
    hunting: {
      hiring_regime: "clt",
      salary_min: 9000,
      salary_max: 12000,
      salary_currency: "BRL",
      fee_type: "percent",
      fee_value: 20,
      fee_terms: "SEGREDO-HONORARIO",
    },
    selection: { stages: ["Técnica"], criteria: "ok" },
  });
  return {
    title: "Delphi Sênior",
    quantity: 2,
    modality: "both",
    priority: "high",
    seniority: "senior",
    contact_id: null,
    data,
    ...over,
  };
}

describe("perfil de vaga — mínimos e completude (sem pontuação)", () => {
  it("rascunho parcial é válido mas bloqueia aprovação com lista do que falta", () => {
    const p: ProfileLike = {
      title: "Delphi Pleno",
      quantity: 3,
      modality: "outsourcing",
      priority: "medium",
      seniority: null,
      data: emptyData(),
    };
    const miss = approvalMissing(p);
    expect(miss).toEqual(
      expect.arrayContaining([
        "Senioridade",
        "Responsabilidades",
        "Ao menos uma tecnologia obrigatória",
        "Modelo de trabalho",
        "Duração da alocação",
        "Dedicação",
      ]),
    );
    expect(miss).not.toContain("Regime de contratação");
    const c = completeness(p);
    expect(c.total).toBeGreaterThan(0);
    expect(c.total).toBeLessThan(1);
  });
  it("perfil completo 'ambos' exige condições das duas modalidades", () => {
    expect(approvalMissing(full())).toEqual([]);
    const p = full();
    p.data.hunting.hiring_regime = undefined;
    expect(approvalMissing(p)).toContain("Regime de contratação");
  });
  it("presencial exige localidade; faixa salarial invertida é bloqueada", () => {
    const p = full();
    p.data.conditions.work_mode = "onsite";
    p.data.hunting.salary_min = 20000;
    expect(approvalMissing(p)).toEqual(
      expect.arrayContaining(["Localidade", "Faixa salarial coerente (mínimo ≤ máximo)"]),
    );
  });
  it("quantidade não positiva é rejeitada pelo schema do cabeçalho via mínimos", () => {
    expect(approvalMissing(full({ quantity: 0 }))).toContain("Quantidade");
  });
});

describe("vazamento zero — cliente e TechHire", () => {
  it("visão do cliente só serializa campos liberados", () => {
    const v = toClientView(full(), [
      "role.responsibilities",
      "hunting.fee_value" as never,
      "x.y" as never,
    ]);
    const json = JSON.stringify(v);
    expect(v.fields.map((f) => f.key)).toEqual(["role.responsibilities"]);
    expect(json).not.toContain("SEGREDO-HONORARIO");
    expect(json).not.toContain("fee");
    expect(json).not.toContain("9000");
  });
  it("allowlist descarta campos inexistentes/internos", () => {
    expect(
      sanitizeAllowedFields(["hunting.fee_value", "evidence", "role.team", "role.team"]),
    ).toEqual(["role.team"]);
  });
  it("proposta do cliente com campo não liberado é recusada (mass assignment)", () => {
    const r = applyClientProposal(full().data, { "hunting.fee_value": 1 }, ["role.team"]);
    expect(r.ok).toBe(false);
    const ok = applyClientProposal(full().data, { "role.team": "8 pessoas" }, ["role.team"]);
    expect(ok.ok && ok.data.role.team).toBe("8 pessoas");
  });
  it("proposta com valor de formato inválido é recusada", () => {
    expect(
      applyClientProposal(full().data, { "conditions.work_mode": "lua" }, ["conditions.work_mode"])
        .ok,
    ).toBe(false);
  });
  it("payload do TechHire não contém honorários nem comercial", () => {
    const job = toAtsJob(full());
    const json = JSON.stringify(job);
    expect(json).not.toContain("SEGREDO-HONORARIO");
    expect(json).not.toMatch(/fee|sale_price|cost|margin/);
    expect(job.salary_min).toBe(9000);
    expect(job.requirements).toContain("Obrigatório:\n- Delphi (5+ anos)");
    expect(job.description).toContain("Posições: 2");
  });
  it("outsourcing puro não envia faixa salarial", () => {
    const job = toAtsJob(full({ modality: "outsourcing" }));
    expect(job.salary_min).toBeNull();
    expect(job.employment_type).toBe("Outsourcing");
  });
});

describe("versões, modelos e margem", () => {
  it("diff destaca senioridade, quantidade e salário", () => {
    const a = full();
    const b = full({ quantity: 3, seniority: "pleno" });
    b.data = structuredClone(b.data);
    b.data.hunting.salary_max = 15000;
    const d = diffProfiles(a, b);
    expect(d.filter((x) => x.important).map((x) => x.label)).toEqual(
      expect.arrayContaining(["Quantidade", "Senioridade", "Salário máximo"]),
    );
  });
  it("modelo/duplicação não leva evidências", () => {
    const p = full();
    p.data.evidence = { "role.team": { source: "x.pdf", status: "found" } };
    const t = toTemplatePayload(p);
    expect(t.data.evidence).toBeUndefined();
    expect(JSON.stringify(t)).not.toMatch(/approved|ats_job|token|assigned_to|contact_id/);
  });
  it("margem só com períodos iguais", () => {
    expect(
      marginPct({
        outsourcing: { sale_price: 100, cost: 60, sale_period: "hour", cost_period: "hour" },
      }),
    ).toBeCloseTo(40);
    expect(
      marginPct({
        outsourcing: { sale_price: 100, cost: 60, sale_period: "hour", cost_period: "month" },
      }),
    ).toBeNull();
  });
});

describe("importação — normalização da proposta da IA", () => {
  it("marca ausentes/duvidosos, descarta salário sem evidência e não inventa", () => {
    const r = normalizeImportedProfile(
      {
        title: { value: "Dev Delphi", status: "found", excerpt: "Dev Delphi" },
        quantity: { value: 2, status: "found" },
        modality: { value: "hunting", status: "doubtful" },
        fields: {
          "requirements.skills": {
            value: [{ name: "Delphi", kind: "required" }],
            status: "found",
            excerpt: "Delphi",
            page: 2,
          },
          "hunting.salary_min": { value: 9000, status: "found" },
          "conditions.work_mode": { value: "marte", status: "found", excerpt: "?" },
          "role.team": { value: null, status: "missing" },
        },
        warnings: ["ok"],
      },
      "vaga.pdf",
    );
    expect(r.header).toMatchObject({ title: "Dev Delphi", quantity: 2, modality: "hunting" });
    expect(r.fieldStatus.modality).toBe("doubtful");
    expect(r.data.hunting.salary_min).toBeUndefined();
    expect(r.fieldStatus["hunting.salary_min"]).toBe("missing");
    expect(r.fieldStatus["conditions.work_mode"]).toBe("doubtful");
    expect(r.data.conditions.work_mode).toBeUndefined();
    expect(r.data.evidence?.["requirements.skills"]).toMatchObject({ source: "vaga.pdf", page: 2 });
    expect(r.fieldStatus["role.team"]).toBe("missing");
  });
  it("resposta vazia gera rascunho neutro", () => {
    const r = normalizeImportedProfile({}, "x");
    expect(r.header.quantity).toBe(1);
    expect(r.data.requirements.skills).toEqual([]);
  });
});

describe("diff estável", () => {
  it("ordem de chaves diferente não gera alteração falsa", () => {
    const a = full();
    const b = full();
    b.data.requirements.skills = b.data.requirements.skills.map((s) => ({
      kind: s.kind,
      years: s.years,
      name: s.name,
    }));
    expect(diffProfiles(a, b)).toEqual([]);
  });
});
