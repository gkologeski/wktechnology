# Inbox WhatsApp: rolagem e janela de 24 h após mensagem recebida

## O que foi confirmado (consultas somente leitura)

- A mensagem do cliente chegou e ficou salva: conversa `0d3b611c…` (telefone +55 48 9110-4003 gravado pela Meta **sem o nono dígito**, `+554891104003`, canal +55 48 6137-0317), com recebimento às 05:33 UTC de hoje. A janela de 24 h está aberta nos dados.
- O mesmo cliente tem mais conversas antigas do canal anterior (Twilio): `+5548991104003` (com o nono dígito) e `+554891104003`. Nenhuma delas tem mensagem recebida.
- Hoje a tela verifica a janela **pelo telefone**, não pela conversa aberta. Essa verificação fica guardada por 30 s e não é refeita quando chega mensagem nova em tempo real. Por isso o aviso "janela encerrada" continua aparecendo depois da resposta do cliente. Se a conversa aberta for a antiga com o nono dígito, a janela nunca abre.
- Rolagem: o casco da Inbox usa altura "cheia" (`h-full`) com mínimo de 32rem e corta o que passa da altura (`overflow-hidden`). Em uma tela de cerca de 650 px de altura, e com o painel de modelo aberto, a área de mensagens não ganha uma altura limitada e fica cortada, sem rolagem. Isso será confirmado no navegador antes de corrigir.

## O que será feito

1. **Janela pela conversa aberta**
   - A verificação da janela passa a usar a conversa selecionada (canal + conversa), não só o telefone.
   - Para um telefone sem conversa, continua a busca pelo telefone, considerando as duas formas do número de celular brasileiro (com e sem o nono dígito).
2. **Janela abre na hora**
   - Quando chega uma mensagem do cliente em tempo real, a tela refaz a verificação na hora e libera texto, anexo e atalho de envio, sem recarregar a página.
   - O rascunho é preservado.
3. **Rolagem**
   - A área de mensagens e a lista de conversas ganham altura limitada e rolagem própria.
   - O painel de modelo/variáveis passa a ter rolagem própria, com altura máxima, para não empurrar o histórico para fora da tela.
   - Validação em telas baixas (cerca de 650 px), no tablet e no celular.
4. **Servidor**
   - O envio continua conferindo a janela no servidor.
   - Essa conferência passa a usar a mesma conversa e o mesmo canal da tela, para a tela e o servidor nunca discordarem.

Fora do escopo: juntar ou apagar as conversas antigas duplicadas (são dados reais). Nada é enviado nem publicado.

## Validação

- Teste para a regra da janela: recebimento há menos de 24 h abre a janela; conversa antiga duplicada do mesmo número não fecha a janela da conversa atual; o número com e sem o nono dígito é tratado como o mesmo celular.
- Verificação completa de tipos, estilo e testes, mais a versão de produção.
- Navegador com sessão autorizada em `/inbox/whatsapp`, em tela de 1183x653: rolagem do histórico e da lista funcionando e a conversa de hoje mostrando a janela aberta. Nenhum envio.

## Detalhes técnicos

- `getWhatsAppServiceWindow`: aceitar `conversation_id` opcional, ler `last_inbound_at` e `wa_phone_number_id` dessa linha (RLS do usuário, workspace ativo). O fallback por telefone usa variantes BR (`+55 DD 9XXXXXXXX` ↔ `+55 DD XXXXXXXX`) e escolhe o maior `last_inbound_at`.
- `use-whatsapp-composer.ts`: incluir `conversationId` na chave da consulta e expor a invalidação. Em `inbox.whatsapp.tsx` (e `inbox.index.tsx`), invalidar quando o tempo real trouxer uma linha `direction = inbound`.
- `sendWhatsAppMessage` / `sendWhatsAppFromServer`: mesma resolução por conversa e variantes do número.
- Layout: `inbox-workspace.tsx` com altura limitada à área visível (`h-[calc(100dvh-…)]` / `min-h-0` na cadeia flex). O painel de modelo em `inbox.whatsapp.tsx` ganha altura máxima com `overflow-y-auto`.
