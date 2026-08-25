import { describe, it, expect } from "vitest";
import { computeProjectFinancials } from "./financials";

describe("computeProjectFinancials", () => {
  it("retorna zeros quando não há dados", () => {
    const r = computeProjectFinancials([], [], []);
    expect(r).toEqual({
      loggedHours: 0,
      realizedCost: 0,
      billableRevenue: 0,
      milestoneRevenue: 0,
      totalRevenue: 0,
      margin: 0,
      hasRates: false,
    });
  });

  it("calcula custo, receita billable e margem por hora", () => {
    const members = [{ user_id: "u1", cost_rate_hour: 100, bill_rate_hour: 250 }];
    const entries = [
      { user_id: "u1", hours: 10, billable: true },
      { user_id: "u1", hours: 5, billable: false }, // não gera receita, gera custo
    ];
    const r = computeProjectFinancials(entries, members, []);
    expect(r.loggedHours).toBe(15);
    expect(r.realizedCost).toBe(1500); // 15h * 100
    expect(r.billableRevenue).toBe(2500); // 10h * 250
    expect(r.milestoneRevenue).toBe(0);
    expect(r.totalRevenue).toBe(2500);
    expect(r.margin).toBe(1000);
    expect(r.hasRates).toBe(true);
  });

  it("soma marcos billable com status=done e ignora os demais", () => {
    const milestones = [
      { bill_amount: 1000, billable: true, status: "done" },
      { bill_amount: 500, billable: true, status: "pending" }, // ignorado
      { bill_amount: 999, billable: false, status: "done" }, // ignorado
      { bill_amount: 300, billable: true, status: "done" },
    ];
    const r = computeProjectFinancials([], [], milestones);
    expect(r.milestoneRevenue).toBe(1300);
    expect(r.totalRevenue).toBe(1300);
    expect(r.margin).toBe(1300);
  });

  it("horas de membro sem taxas cadastradas viram custo/receita 0", () => {
    const entries = [{ user_id: "sem-membro", hours: 8, billable: true }];
    const r = computeProjectFinancials(entries, [], []);
    expect(r.loggedHours).toBe(8);
    expect(r.realizedCost).toBe(0);
    expect(r.billableRevenue).toBe(0);
    expect(r.hasRates).toBe(false);
  });

  it("aceita strings numéricas (postgres numeric)", () => {
    const members = [{ user_id: "u1", cost_rate_hour: "80.50", bill_rate_hour: "200.00" }];
    const entries = [{ user_id: "u1", hours: "2", billable: true }];
    const milestones = [{ bill_amount: "150.25", billable: true, status: "done" }];
    const r = computeProjectFinancials(entries, members, milestones);
    expect(r.realizedCost).toBeCloseTo(161);
    expect(r.billableRevenue).toBeCloseTo(400);
    expect(r.milestoneRevenue).toBeCloseTo(150.25);
    expect(r.totalRevenue).toBeCloseTo(550.25);
    expect(r.margin).toBeCloseTo(389.25);
  });

  it("hasRates=false quando membro existe mas taxas são zero", () => {
    const members = [{ user_id: "u1", cost_rate_hour: 0, bill_rate_hour: null }];
    const r = computeProjectFinancials([], members, []);
    expect(r.hasRates).toBe(false);
  });

  it("é resiliente a null em entries/members/milestones", () => {
    const r = computeProjectFinancials(null, null, null);
    expect(r.loggedHours).toBe(0);
    expect(r.totalRevenue).toBe(0);
  });
});
