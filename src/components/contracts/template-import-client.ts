// Cliente da rota em fluxo de conversão de modelo (NDJSON com pings).
import { supabase } from "@/integrations/supabase/client";
import type { ImportedTemplate } from "@/lib/contracts/template-import.functions";

type Input = { filename: string; kind: "pdf"; base64: string } | { filename: string; kind: "html"; html: string };

export async function convertTemplateStreaming(input: Input): Promise<ImportedTemplate> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");

  let res: Response;
  try {
    res = await fetch("/api/contracts/template-import", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error("A conexão caiu durante a análise. Tente novamente.");
  }
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new Error(t.slice(0, 200) || `Falha na conversão (${res.status}).`);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const msg = JSON.parse(line) as { type: string; result?: ImportedTemplate; message?: string };
        if (msg.type === "result" && msg.result) return msg.result;
        if (msg.type === "error") throw new Error(msg.message || "Falha na conversão");
      }
      if (done) break;
    }
  } catch (e) {
    if (e instanceof Error && e.message && !/fetch|network/i.test(e.message)) throw e;
    throw new Error("A conexão caiu durante a análise. Tente novamente.");
  }
  throw new Error("A análise terminou sem resultado. Tente novamente.");
}
