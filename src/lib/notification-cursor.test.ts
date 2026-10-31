import { describe, expect, it } from "vitest";
import { cursorFilter, nextCursorOf } from "./notification-cursor";

describe("cursor de notificações", () => {
  it("página cheia gera cursor a partir do último item", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      id: `id-${i}`,
      created_at: `2026-10-${String(30 - (i % 28)).padStart(2, "0")}T10:00:00Z`,
    }));
    expect(nextCursorOf(rows)).toEqual({ id: "id-29", createdAt: rows[29].created_at });
  });
  it("página incompleta encerra o histórico", () => {
    expect(nextCursorOf([{ id: "a", created_at: "2026-10-01T00:00:00Z" }])).toBeNull();
  });
  it("filtro exclui o próprio item do cursor (sem repetir)", () => {
    expect(cursorFilter({ createdAt: "2026-10-01T00:00:00Z", id: "x" })).toBe(
      "created_at.lt.2026-10-01T00:00:00Z,and(created_at.eq.2026-10-01T00:00:00Z,id.lt.x)",
    );
  });
});
