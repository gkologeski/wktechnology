import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupLegalEntityCnpj, lookupLegalEntityCep } from "./legal-entity-lookup.server";

const client = {
  rpc: vi.fn().mockResolvedValue({ data: "184b9435-0a9b-4334-9e89-8854dc883f5d", error: null }),
} as unknown as SupabaseClient;

afterEach(() => vi.unstubAllGlobals());
describe("public registry lookup", () => {
  it("uses BrasilAPI structured address and does not send credentials", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        razao_social: "Empresa SA",
        nome_fantasia: "Empresa",
        descricao_tipo_de_logradouro: "RUA",
        logradouro: "A",
        numero: "10",
        municipio: "CURITIBA",
        uf: "PR",
        cep: "80000000",
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(await lookupLegalEntityCnpj(client, "19.133.530/0001-36")).toMatchObject({
      name: "Empresa SA",
      source: "brasilapi",
      address: { street: "RUA A", number: "10", zip_code: "80000-000" },
    });
    expect(fetcher).toHaveBeenCalledWith("https://brasilapi.com.br/api/cnpj/v1/19133530000136", {
      signal: expect.any(AbortSignal),
      redirect: "manual",
    });
  });
  it("falls back to ReceitaWS on primary failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce(
          Response.json({
            nome: "Fallback Ltda",
            fantasia: "Fallback",
            logradouro: "Rua C",
            numero: "20",
            cep: "88000000",
          }),
        ),
    );
    expect(await lookupLegalEntityCnpj(client, "19133530000136")).toMatchObject({
      name: "Fallback Ltda",
      source: "receitaws",
      address: { street: "Rua C", number: "20" },
    });
  });
  it("reports unavailable services without fabricating data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status: "ERROR" })));
    await expect(lookupLegalEntityCnpj(client, "19133530000136")).rejects.toThrow(
      "Não foi possível consultar",
    );
  });
  it("auto-pads valid 13-digit leading-zero CNPJ before calling BrasilAPI", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        cnpj: "03938048000133",
        razao_social: "BROOKS AMBIENTAL LTDA",
        nome_fantasia: "BROOKS",
        logradouro: "CENTRAL",
        numero: "100",
        municipio: "PALHOCA",
        uf: "SC",
        cep: "88130000",
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(await lookupLegalEntityCnpj(client, "3938048000133")).toMatchObject({
      name: "BROOKS AMBIENTAL LTDA",
      source: "brasilapi",
    });
    expect(fetcher).toHaveBeenCalledWith("https://brasilapi.com.br/api/cnpj/v1/03938048000133", {
      signal: expect.any(AbortSignal),
      redirect: "manual",
    });
  });
  it("distinguishes confirmed not_found from rate limit and service instability", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(new Response(null, { status: 404 })),
    );
    await expect(lookupLegalEntityCnpj(client, "03938048000133")).rejects.toThrow(
      "CNPJ não encontrado nas bases públicas",
    );

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(new Response(null, { status: 429 })),
    );
    await expect(lookupLegalEntityCnpj(client, "03938048000133")).rejects.toThrow(
      "limite temporário de requisições",
    );
  });
  it("rejects invalid CNPJ before any request", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(lookupLegalEntityCnpj(client, "11111111111111")).rejects.toThrow("CNPJ inválido");
    expect(f).not.toHaveBeenCalled();
  });
  it("CEP returns location only and leaves number/complement to the user", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          logradouro: "Rua A",
          bairro: "Centro",
          localidade: "Florianópolis",
          uf: "SC",
        }),
      ),
    );
    expect(await lookupLegalEntityCep(client, "88000-000")).toEqual({
      street: "Rua A",
      neighborhood: "Centro",
      city: "Florianópolis",
      state: "SC",
    });
  });
  it("reports unknown CEP", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ erro: true })));
    await expect(lookupLegalEntityCep(client, "88000000")).rejects.toThrow("CEP não encontrado");
  });
});
