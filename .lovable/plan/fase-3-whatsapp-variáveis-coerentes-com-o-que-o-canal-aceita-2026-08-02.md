# Fase 3 — WhatsApp: variáveis coerentes com o que o canal aceita

## Situação confirmada no código

- `src/components/whatsapp/send-whatsapp-dialog.tsx` (modo "Mensagem livre") mostra pills nomeadas (`{{first_name}}`, `{{full_name}}`, `{{company}}`) de `WHATSAPP_TOKENS`, mas o envio (`sendWhatsAppMessage` em `src/lib/whatsapp.functions.ts`) manda o corpo sem nenhuma substituição — o texto sai literal para o contato.
- No modo com template, o formato real é posicional: `applyTemplate` substitui apenas `{{1}}`, `{{2}}`… e o diálogo já pede "Variável {{1}}", "Variável {{2}}". Nesse modo as pills nomeadas nem aparecem.
- Campanhas de WhatsApp (`/campaigns/whatsapp` + `src/routes/api/public/hooks/whatsapp-campaign-tick.ts`) já usam somente posicional via `applyTemplate` e não exibem pills nomeadas — nada a corrigir ali.
- Editor de templates (`whatsapp-templates-editor.tsx`) já orienta corretamente o uso de `{{1}}`, `{{2}}`.

## O que será feito

1. Mensagem livre passa a resolver as variáveis de verdade
   - Buscar os dados do contato (nome, sobrenome, nome completo, e-mail, empresa) quando houver `contactId`, e montar o contexto de tokens.
   - Aplicar o renderizador único (`renderTokens` de `src/lib/email-tokens.ts`, já com suporte a chaves com ponto na Fase 2) no corpo antes de enviar, e também no preview exibido no diálogo.
   - Incluir `{{agent.name}}` / `{{agent.email}}` (remetente) no contexto, igual ao envio de e-mail.
   - Mostrar somente as pills que o contexto realmente resolve; sem contato vinculado, exibir apenas as do remetente.

2. Modo template deixa de oferecer pills nomeadas e ganha atalhos posicionais
   - Manter os campos "Variável {{1}}…{{n}}" como fonte da verdade.
   - Em cada campo, oferecer atalhos de preenchimento rápido com valores conhecidos do contato (Nome, Nome completo, Empresa, E-mail) — insere o valor já resolvido, não o token, porque o WhatsApp oficial (HSM) recebe valores literais.

3. Catálogo
   - `WHATSAPP_TOKENS` em `src/lib/message-tokens-catalog.ts` passa a refletir o que é resolvido em mensagem livre (contato + remetente), com comentário explicando que template oficial usa posicional.

## Detalhes técnicos

- Contexto do contato: reaproveitar a mesma abordagem já usada no envio de e-mail por entidade (consulta de contato por id) em vez de criar nova server function, se a existente atender; caso não atenda, adicionar uma leitura enxuta (apenas as colunas necessárias) em módulo de funções existente.
- Substituição sempre no envio e no preview, para o usuário ver exatamente o que será entregue.
- Sem mudanças de schema, RLS, permissões ou regra de negócio. HSM oficial continua enviando `contentVariables` posicionais.

## Validação

- `bunx tsgo --noEmit`, `bunx eslint` nos arquivos alterados, `bunx vitest run`.
- Manual: abrir WhatsApp em um contato, escrever "Olá {{first_name}} da {{company}}" → preview e mensagem enviada com valores resolvidos; selecionar um template oficial → apenas campos posicionais, com atalhos de valor do contato.

## Escopo

Somente as variáveis do WhatsApp. Fase 4 (centralizar o renderizador e cobrir com testes por superfície) fica para depois, sob sua confirmação.
