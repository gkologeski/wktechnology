// Painel de conexão do WhatsApp (canal único via conexão WhatsApp Business do Lovable).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WhatsAppConnectionState = {
  configured: boolean;
  connected: boolean;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  qualityRating?: string;
  platformType?: string;
  isOnBizApp?: boolean;
  error?: string;
};

export const getWhatsAppConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<WhatsAppConnectionState> => {
    const { gatewayConfigured, getConnectedPhone } =
      await import("@/lib/whatsapp/gateway-channel.server");
    if (!gatewayConfigured()) {
      return {
        configured: false,
        connected: false,
        error: "Nenhuma conexão do WhatsApp Business vinculada a este projeto.",
      };
    }
    try {
      const phone = await getConnectedPhone();
      return {
        configured: true,
        connected: true,
        phoneNumberId: phone.id,
        displayPhoneNumber: phone.display_phone_number,
        verifiedName: phone.verified_name,
        qualityRating: phone.quality_rating,
        platformType: phone.platform_type,
        isOnBizApp: phone.is_on_biz_app,
      };
    } catch (err) {
      return {
        configured: true,
        connected: false,
        error: err instanceof Error ? err.message : "Falha ao consultar a conexão do WhatsApp.",
      };
    }
  });

export const testWhatsAppConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<WhatsAppConnectionState> => {
    const { gatewayConfigured, getConnectedPhone } =
      await import("@/lib/whatsapp/gateway-channel.server");
    if (!gatewayConfigured()) {
      return {
        configured: false,
        connected: false,
        error: "Nenhuma conexão do WhatsApp Business vinculada a este projeto.",
      };
    }
    try {
      const phone = await getConnectedPhone();
      return {
        configured: true,
        connected: true,
        phoneNumberId: phone.id,
        displayPhoneNumber: phone.display_phone_number,
        verifiedName: phone.verified_name,
        qualityRating: phone.quality_rating,
        platformType: phone.platform_type,
        isOnBizApp: phone.is_on_biz_app,
      };
    } catch (err) {
      return {
        configured: true,
        connected: false,
        error: err instanceof Error ? err.message : "Falha ao testar a conexão do WhatsApp.",
      };
    }
  });
