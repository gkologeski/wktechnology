// Mapeamento client-safe do resultado da sonda de credenciais Twilio Voice.
export type ProbeResult = { ok: boolean; reason?: string; transient: boolean };

export function mapProbeStatus(status: number): ProbeResult {
  if (status >= 200 && status < 300) return { ok: true, transient: false };
  if (status === 401)
    return { ok: false, reason: "Telefonia com credenciais inválidas", transient: false };
  if (status === 404)
    return { ok: false, reason: "Chave da telefonia em outra conta", transient: false };
  return { ok: false, reason: `Telefonia indisponível (${status})`, transient: true };
}
