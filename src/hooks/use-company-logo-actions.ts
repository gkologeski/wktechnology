import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { searchCompanyLogos } from "@/lib/companies/logo-search.functions";

export const LOGO_MAX_BYTES = 1024 * 1024;
export const LOGO_ACCEPT = "image/png,image/jpeg,image/svg+xml,image/webp";
const OUTPUT_PX = 128;

/** Redimensiona para 128px (WEBP) mantendo a proporção; resultado leve para listas. */
export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!LOGO_ACCEPT.split(",").includes(file.type)) {
    throw new Error("Formato não suportado. Use PNG, JPG, SVG ou WEBP.");
  }
  if (file.size > LOGO_MAX_BYTES) throw new Error("O arquivo passa de 1 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      el.src = url;
    });
    const w = img.naturalWidth || OUTPUT_PX;
    const h = img.naturalHeight || OUTPUT_PX;
    const scale = Math.min(1, OUTPUT_PX / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível processar a imagem.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Patch = {
  logo_url?: string | null;
  logo_source?: "manual" | "auto" | "none";
  website?: string;
  domain?: string;
};

export function useCompanyLogoActions(companyId: string, onDone?: () => void) {
  const qc = useQueryClient();
  const search = useServerFn(searchCompanyLogos);

  const save = useMutation({
    mutationFn: async (patch: Patch) => {
      const { data, error } = await supabase
        .from("companies")
        .update({ ...patch, logo_updated_at: new Date().toISOString() })
        .eq("id", companyId)
        .select("id");
      if (error) throw error;
      // RLS negada não gera erro: nenhuma linha atualizada.
      if (!data?.length) throw new Error("Você não tem permissão para editar esta empresa.");
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["company-logos"] });
      await qc.invalidateQueries({ queryKey: ["companies"] });
      onDone?.();
    },
  });

  const find = useMutation({
    mutationFn: async (query: string) => {
      const res = await search({ data: { query } });
      if (res.error) throw new Error(res.error);
      return res.items;
    },
  });

  return { save, find };
}
