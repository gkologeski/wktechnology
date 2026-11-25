import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fileToLogoDataUrl,
  useCompanyLogoActions as createLogoActions,
} from "./use-company-logo-actions";

const db = vi.hoisted(() => ({ select: vi.fn(), eq: vi.fn(), update: vi.fn(), from: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: { mutationFn: (data: unknown) => Promise<unknown> }) => ({
    mutateAsync: options.mutationFn,
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: db.from } }));
vi.mock("@/lib/companies/logo-search.functions", () => ({ searchCompanyLogos: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockImage(width: number, height: number) {
  const encode = vi.fn(() => "data:image/webp;base64,encoded");
  const draw = vi.fn();
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:logo-test");
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: draw }),
    toDataURL: encode,
  };
  vi.stubGlobal("document", { createElement: () => canvas });
  vi.stubGlobal(
    "Image",
    class {
      naturalWidth = width;
      naturalHeight = height;
      onload?: () => void;
      set src(_value: string) {
        this.onload?.();
      }
    },
  );
  return { canvas, encode, revoke };
}

describe("Envio do logo da empresa para documentos", () => {
  it("gera até 512 px preservando proporção e qualidade 0.95", async () => {
    const { canvas, encode, revoke } = mockImage(2048, 640);
    await fileToLogoDataUrl(new File(["logo"], "logo.png", { type: "image/png" }));
    expect([canvas.width, canvas.height]).toEqual([512, 160]);
    expect(encode).toHaveBeenCalledWith("image/webp", 0.95);
    expect(revoke).toHaveBeenCalledWith("blob:logo-test");
  });

  it("não amplia um logo antigo de 128 por 40 px", async () => {
    const { canvas } = mockImage(128, 40);
    await fileToLogoDataUrl(new File(["logo"], "logo.webp", { type: "image/webp" }));
    expect([canvas.width, canvas.height]).toEqual([128, 40]);
  });

  it("preserva o limite de envio de 1 MB", async () => {
    await expect(
      fileToLogoDataUrl(
        new File([new Uint8Array(1024 * 1024 + 1)], "logo.png", { type: "image/png" }),
      ),
    ).rejects.toThrow("O arquivo passa de 1 MB.");
  });

  it("rejeita formato não suportado antes de processar", async () => {
    await expect(
      fileToLogoDataUrl(new File(["<html>"], "logo.html", { type: "text/html" })),
    ).rejects.toThrow("Formato não suportado.");
  });
});

// Exercita o consumidor real; respostas RLS são simuladas, não uma prova SQL.
async function saveLogoResponse(data: { id: string }[] | null, error: Error | null = null) {
  db.from.mockReturnValue({ update: db.update });
  db.update.mockReturnValue({ eq: db.eq });
  db.eq.mockReturnValue({ select: db.select });
  db.select.mockResolvedValueOnce({ data, error });
  return createLogoActions("company-a").save.mutateAsync({
    logo_url: "https://cdn.example.com/logo.png",
    logo_source: "manual",
  });
}

describe("Gravação do logo mantém recusas do banco (mock RLS)", () => {
  it("logo save accepts an authorized row", async () => {
    await expect(saveLogoResponse([{ id: "company-a" }])).resolves.toBeUndefined();
    expect(db.from).toHaveBeenLastCalledWith("companies");
    expect(db.eq).toHaveBeenLastCalledWith("id", "company-a");
  });
  it("logo save rejects missing permission with zero rows", async () => {
    await expect(saveLogoResponse([])).rejects.toThrow(
      "Você não tem permissão para editar esta empresa.",
    );
  });
  it("logo save propagates explicit deny from RLS", async () => {
    await expect(saveLogoResponse(null, new Error("explicit deny"))).rejects.toThrow(
      "explicit deny",
    );
  });
  it("logo save rejects foreign workspace with zero rows", async () => {
    await expect(saveLogoResponse([])).rejects.toThrow(
      "Você não tem permissão para editar esta empresa.",
    );
  });
  it("logo save propagates inactive member refusal", async () => {
    await expect(saveLogoResponse(null, new Error("inactive member"))).rejects.toThrow(
      "inactive member",
    );
  });
});
