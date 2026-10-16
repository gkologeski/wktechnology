# Associação automática por telefone após disparo de WhatsApp

## Diagnóstico (conferido no banco e no código)
- A busca por telefone (com/sem 9º dígito, com/sem 55) já existe, mas só roda quando o **cliente responde**. Envios pela campanha, Inbox e timeline criam a conversa sem tentar associar: 36 de 50 conversas estão "não verificadas" e 38 estão sem cliente.
- O número do print (+55 21 9402-5475) veio da campanha a partir de uma **Empresa**, não de um contato ou lead. Não existe nenhum contato ou lead com esse telefone em nenhum formato, por isso nem uma busca melhor o associaria.

## O que será feito
1. **Associar no momento do envio.** Campanha, Inbox, timeline e Lia passam a associar a conversa assim que a mensagem sai:
   - primeiro, usando o registro de origem do destinatário da campanha (contato ou lead), quando houver;
   - senão, buscando o telefone em telefone e celular de Contatos e Leads do workspace, no padrão E.164 e nas variantes com e sem 9º dígito e com e sem 55.
   - Contato tem prioridade sobre Lead. Mais de um resultado vira "ambíguo" para escolha manual. Associação manual nunca é sobrescrita.
2. **Origem Empresa.** Quando o público vem de Empresas, procurar entre os contatos daquela empresa o que tem esse telefone. Sem correspondência, a conversa fica sem associação, mas mostra o nome da empresa de origem como sugestão.
3. **Normalização E.164 mais tolerante.** Ignorar zeros à esquerda, operadora (ex.: 0 21 …), traços, parênteses e valores lixo ("--", "0"). Assim "+55-51-99301-6927", "(51) 9301-6927" e "5551993016927" se encontram.
4. **Histórico completo.** Rodar uma vez em todas as conversas de WhatsApp do workspace que estão sem cliente e não foram associadas manualmente, também vinculando destinatários de campanhas já disparadas. Mostrar o resultado: quantas foram associadas, quantas ficaram ambíguas e quantas não têm cadastro.
5. Novas conversas (inclusive respostas) continuam usando a mesma regra única.

## Fora do escopo
- Criar contatos ou leads automaticamente.
- Mesclar registros duplicados.
- Associar conversa diretamente a Empresa ou Negócio.

## Detalhes técnicos
- Reutilizar `resolveInboxIdentity` / `buildBrPhoneVariants` (`src/lib/inbox/identity-resolution.server.ts`) chamando nos caminhos de envio (`whatsapp-send.server.ts`, `whatsapp.functions.ts`, `hooks/whatsapp-campaign-tick.ts`, envio da Lia) após o upsert da conversa, só quando `contact_id`/`lead_id` vazios e `identity_status <> 'manual'`.
- Origem do destinatário via `whatsapp_campaign_recipients.contact_id` e `variables._source` (`lead:`, `contact:`, `company:`, `deal:` → contato principal).
- Sem migration: as colunas `contact_id`, `lead_id` e `identity_status` e os dígitos gerados (`phone_digits`, `mobile_phone_digits`) já existem.
- Backfill por script com o cliente do servidor restrito ao workspace WK, sem tocar outros workspaces nem conversas `manual`.

## Validação
- Testes unitários: variantes E.164 com/sem 9º dígito, formatos sujos, prioridade Contato→Lead, ambíguo, origem empresa, manual preservado.
- Typecheck, lint e testes de WhatsApp com resultados reais.
- Playwright na Inbox do WhatsApp com sessão real: conversa de campanha aparece já associada.
- Nenhuma mensagem enviada e nada publicado sem aceite.
