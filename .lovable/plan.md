# ROTACAO-NUMEROS — Rodízio de números remetentes na campanha de WhatsApp

Porte: M — estimativa 3 a 4 h (implementação + testes + Ajuda + permissões + validação no navegador). Não publica.

## O que muda para o usuário
- No formulário da campanha, o campo "Número remetente" passa a aceitar até 5 números (o primeiro é o principal), no mesmo padrão do rodízio de modelos.
- Modo de rodízio: "Intercalar em sequência" ou "Sortear", como nos modelos.
- Cada contato fica preso ao número que recebeu a primeira mensagem: retomadas e a resposta da Lia seguem pelo mesmo número; ninguém recebe a campanha por dois números.
- Ao salvar, o sistema confere se cada número está ativo e se todos os modelos escolhidos (principal e rodízio) estão aprovados na conta de cada número; se não estiverem, mostra qual número/modelo falta.
- Se um número cair (desconectado, bloqueado pela Meta) durante o disparo, os novos contatos passam aos demais; contatos já presos a ele ficam pendentes com motivo visível, sem trocar de número.

## Regras
- Sem rodízio configurado, comportamento atual inalterado.
- Ritmo (intervalo entre envios) continua por campanha, não por número.
- Remetentes misturados (Cloud x Meta) não são permitidos na mesma campanha.

## Detalhes técnicos
- Migração aditiva: `whatsapp_campaigns.sender_rotation text[]` (até 5, principal em `sender_phone_number_id`) + `sender_rotation_mode`; `whatsapp_campaign_recipients.sender_phone_number_id` (fixado no primeiro envio). Sem mudança de RLS (colunas herdam políticas existentes).
- Lógica pura nova `src/lib/whatsapp/campaign-sender-rotation.ts` (+ teste), espelhando `campaign-template-rotation.ts`.
- `whatsapp-campaigns.functions.ts`: validação zod e no servidor (números do workspace, ativos, modelos aprovados por WABA).
- `whatsapp-campaign-tick.ts`: resolve o número por destinatário via `resolveWaNumber`, grava o número fixado, conversa criada com o `wa_phone_number_id` escolhido.
- UI: seletor múltiplo no formulário da campanha, reaproveitando o componente do rodízio de modelos.
- Permissão: reutiliza a chave de edição de campanhas WhatsApp (mesmo recurso/ação); contrato em `permission-contracts.json`.
- Ajuda: atualizar artigo de campanhas WhatsApp (bump de versão) e aplicar pelo botão oficial.
- AGENTS.md de `src/lib/whatsapp`: regra do rodízio de números.
- Validação: testes de rodízio/fixação, `permissions:check`, `help:coverage`, e Playwright no formulário.
