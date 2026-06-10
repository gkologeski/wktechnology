import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/dpa")({
  head: () => ({
    meta: [
      { title: "DPA — Acordo de Processamento de Dados — WK Technology CRM" },
      { name: "description", content: "Data Processing Agreement (DPA) do WK Technology CRM para clientes B2B, alinhado à LGPD e ao GDPR." },
      { property: "og:title", content: "DPA — Acordo de Processamento de Dados — WK Technology CRM" },
      { property: "og:description", content: "Acordo de Processamento de Dados do WK Technology CRM para clientes B2B, alinhado à LGPD e ao GDPR." },
      { property: "og:url", content: "https://crm.wktechnology.com.br/dpa" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://crm.wktechnology.com.br/dpa" }],
  }),
  component: DpaPage,
});

function DpaPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link to="/" className="text-sm text-primary hover:underline">← Voltar</Link>
          <h1 className="mt-2 text-3xl font-bold">Acordo de Processamento de Dados (DPA)</h1>
          <p className="text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>
        </div>

        <section className="space-y-3 text-sm leading-relaxed text-foreground">
          <h2 className="text-lg font-semibold">1. Partes</h2>
          <p>
            Este DPA é celebrado entre o <strong>Cliente</strong> (Controlador) e a
            <strong> WK Technology</strong>, na qualidade de <strong>Operador</strong>, e complementa
            os Termos de Serviço. Em caso de conflito sobre tratamento de dados pessoais, prevalece
            este DPA.
          </p>

          <h2 className="text-lg font-semibold">2. Objeto e duração</h2>
          <p>
            A WK Technology trata dados pessoais em nome do Cliente exclusivamente para prestar os
            serviços contratados (CRM, automações, comunicação omnichannel, faturamento), pelo prazo
            da assinatura ativa.
          </p>

          <h2 className="text-lg font-semibold">3. Tipos de dados e titulares</h2>
          <p>
            Dados de contatos, leads, clientes, fornecedores e colaboradores do Cliente, contendo
            dados de identificação, contato, profissionais, históricos comerciais e mensagens.
            Não tratamos dados sensíveis intencionalmente; cabe ao Cliente evitar inseri-los.
          </p>

          <h2 className="text-lg font-semibold">4. Obrigações da WK Technology</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Tratar dados apenas conforme instruções documentadas do Cliente.</li>
            <li>Manter sigilo profissional dos agentes autorizados.</li>
            <li>Implementar medidas técnicas e organizacionais (RLS, criptografia em trânsito e repouso, controle de acesso, logs de auditoria, backups diários).</li>
            <li>Comunicar incidentes de segurança em até <strong>48 horas</strong> da ciência.</li>
            <li>Apoiar o Cliente no atendimento a direitos de titulares e à ANPD.</li>
            <li>Devolver ou eliminar os dados em até 30 dias após o término do contrato.</li>
          </ul>

          <h2 className="text-lg font-semibold">5. Suboperadores</h2>
          <p>
            O Cliente autoriza o uso dos seguintes suboperadores: Lovable Cloud (hospedagem e banco
            de dados), Cloudflare (edge/CDN), Twilio (telefonia/SMS), Meta (WhatsApp Business),
            Stripe e gateways BR (pagamentos), Google e Microsoft (calendário/e-mail quando habilitados).
            Alterações relevantes serão comunicadas com 30 dias de antecedência.
          </p>

          <h2 className="text-lg font-semibold">6. Transferência internacional</h2>
          <p>
            Dados podem ser processados em data centers fora do Brasil (EUA/UE) sob salvaguardas
            adequadas (cláusulas-padrão contratuais, certificações SOC 2/ISO 27001 dos suboperadores).
          </p>

          <h2 className="text-lg font-semibold">7. Direitos dos titulares</h2>
          <p>
            O Cliente pode atender solicitações de titulares utilizando as ferramentas de exportação
            e exclusão disponíveis em{" "}
            <Link to="/settings/privacy" className="text-primary hover:underline">Configurações → Privacidade</Link>.
            A WK prestará suporte técnico razoável quando necessário.
          </p>

          <h2 className="text-lg font-semibold">8. Encarregado (DPO)</h2>
          <p>
            Encarregado pela WK Technology:{" "}
            <a href="mailto:dpo@wktechnology.com.br" className="text-primary hover:underline">
              dpo@wktechnology.com.br
            </a>.
          </p>

          <h2 className="text-lg font-semibold">9. Aceite</h2>
          <p>
            O aceite eletrônico dos Termos de Serviço, juntamente com a contratação de plano pago,
            implica adesão a este DPA. Para versão assinada, solicite ao financeiro.
          </p>
        </section>

        <div className="pt-4 border-t flex gap-4">
          <Link to="/terms" className="text-sm text-primary hover:underline">Termos</Link>
          <Link to="/privacy" className="text-sm text-primary hover:underline">Privacidade</Link>
          <Link to="/refund" className="text-sm text-primary hover:underline">Reembolso</Link>
        </div>
      </div>
    </div>
  );
}
