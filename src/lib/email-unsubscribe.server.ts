import { supabaseAdmin } from "@/integrations/supabase/client.server";

function randomHexToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getOrCreateEmailUnsubscribeToken(email: string): Promise<string> {
  const normalizedEmail = email.toLowerCase();

  const { data: suppressed, error: suppressionError } = await supabaseAdmin
    .from("suppressed_emails")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (suppressionError) {
    throw new Error(`Falha ao consultar supressão de e-mail: ${suppressionError.message}`);
  }
  if (suppressed) throw new Error("E-mail está na lista de supressão.");

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (lookupError)
    throw new Error(`Falha ao consultar token de descadastro: ${lookupError.message}`);
  if (existing?.used_at) throw new Error("E-mail descadastrado.");
  if (existing?.token) return existing.token as string;

  const token = randomHexToken();
  const { error: insertError } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .upsert({ email: normalizedEmail, token } as never, {
      onConflict: "email",
      ignoreDuplicates: true,
    });
  if (insertError) throw new Error(`Falha ao criar token de descadastro: ${insertError.message}`);

  const { data: stored, error: readError } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (readError || !stored?.token) {
    throw new Error(readError?.message ?? "Falha ao confirmar token de descadastro");
  }
  if (stored.used_at) throw new Error("E-mail descadastrado.");
  return stored.token as string;
}
