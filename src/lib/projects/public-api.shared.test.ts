import { describe, expect, it } from "vitest";
import { canonicalJson, mapApiDbError, PublicTimeEntryInput, resolveIdempotencyKey, toEntryPayload } from "./public-api.shared";

const body = {
  project_id: "00000000-0000-4000-8000-000000000001",
  task_id: "00000000-0000-4000-8000-000000000002",
  entry_date: "2026-03-04",
};

describe("API pública v1 — regras puras", () => {
  it("corpo não aceita situação, usuário nem custo (strict)", () => {
    expect(PublicTimeEntryInput.safeParse({ ...body, duration_seconds: 3600, status: "approved" }).success).toBe(false);
    expect(PublicTimeEntryInput.safeParse({ ...body, duration_seconds: 3600, user_id: body.task_id }).success).toBe(false);
    expect(PublicTimeEntryInput.safeParse({ ...body, duration_seconds: 3600, hourly_rate: 10 }).success).toBe(false);
  });

  it("minutos legados viram segundos exatos; intervalo vira modo interval", () => {
    expect(toEntryPayload(PublicTimeEntryInput.parse({ ...body, duration_minutes: 90 }))).toMatchObject({ mode: "duration", duration_seconds: 5400 });
    expect(toEntryPayload(PublicTimeEntryInput.parse({ ...body, start_time: "09:00:00", end_time: "10:30:15" }))).toMatchObject({
      mode: "interval",
      start_time: "09:00:00",
      end_time: "10:30:15",
    });
  });

  it("hash do pedido não depende da ordem dos campos", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [1, { y: 1, x: 2 }] } })).toBe(canonicalJson({ a: { c: [1, { x: 2, y: 1 }], d: 2 }, b: 1 }));
  });

  it("Idempotency-Key tem prioridade; external_id é aceito por compatibilidade", () => {
    expect(resolveIdempotencyKey("abc-12345", "ext")).toBe("abc-12345");
    expect(resolveIdempotencyKey(null, "ext-1")).toBe("external:ext-1");
    expect(resolveIdempotencyKey("  ", undefined)).toBeNull();
  });

  it.each([
    ["ERROR: API_KEY_INVALID", 401, "unauthorized"],
    ["API_SUBJECT_INACTIVE: o dono da chave não é membro ativo", 403, "forbidden"],
    ["IDEMPOTENCY_CONFLICT: a mesma Idempotency-Key", 409, "idempotency_conflict"],
    ["PERIOD_CLOSED: competência fechada", 409, "period_closed"],
    ["Já existe um apontamento entre 09:00 e 10:00 neste dia.", 409, "overlap"],
    ["Profissional sem vínculo para apontar neste projeto", 403, "forbidden"],
    ["NOT_FOUND: atividade não encontrada neste projeto.", 404, "not_found"],
    ["INVALID_INPUT: duração entre 60 e 86400 segundos.", 400, "invalid_input"],
  ])("traduz '%s' para %i %s", (msg, status, error) => {
    expect(mapApiDbError(msg)).toMatchObject({ status, error });
  });
});
