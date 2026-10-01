// Canal único de WhatsApp: conexão WhatsApp Business do Lovable (connector gateway).
// O gateway injeta os identificadores da conta; nenhuma chave da Meta fica no app.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/whatsapp";

export const WA_NOT_CONNECTED_MESSAGE =
  "WhatsApp não conectado. Conecte o número em Configurações › WhatsApp para enviar mensagens.";

export class WaGatewayError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`WhatsApp erro [${status}]: ${extractMessage(body)}`);
  }
}

function extractMessage(body: string): string {
  try {
    const j = JSON.parse(body);
    return j?.error?.message || j?.message || body.slice(0, 300);
  } catch {
    return body.slice(0, 300);
  }
}

export function gatewayConfigured(): boolean {
  return !!process.env.LOVABLE_API_KEY && !!process.env.WHATSAPP_API_KEY;
}

export async function gatewayFetch(path: string, init: RequestInit = {}): Promise<any> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const waKey = process.env.WHATSAPP_API_KEY;
  if (!lovableKey || !waKey) throw new Error(WA_NOT_CONNECTED_MESSAGE);
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": waKey,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[whatsapp-gateway] ${res.status}: ${text.slice(0, 500)}`);
    throw new WaGatewayError(res.status, text);
  }
  return text ? JSON.parse(text) : null;
}

export type WaPhoneInfo = {
  id: string;
  display_phone_number: string;
  verified_name?: string;
  quality_rating?: string;
  platform_type?: string;
  is_on_biz_app?: boolean;
};

export async function getConnectedPhone(): Promise<WaPhoneInfo> {
  return gatewayFetch(
    "/phone_number?fields=id,display_phone_number,verified_name,quality_rating,platform_type,is_on_biz_app",
  );
}
