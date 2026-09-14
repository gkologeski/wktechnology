# WhatsApp oficial da Meta: migrar o envio do Twilio para a Cloud API

## Como está hoje (verificado no código e no banco)

Já existe (funcionando, sem uso ainda):

- Conexão de conta WhatsApp Business por workspace em **Configurações › WhatsApp (Meta)**: cola-se o WABA ID + token de longa duração, o sistema valida na Meta, assina o webhook e importa os números.
- Recebimento de mensagens pela Meta (webhook oficial com verificação de assinatura), templates oficiais, catálogo de produtos e links de anúncio.
- Envio pela Cloud API já implementado (texto, template e lista de produtos), incluindo controle da janela de 24h.
- Segredos da Meta já cadastrados (App ID, App Secret, verify token, versão da API).

Está faltando:

- **Todo o envio que o usuário usa no dia a dia continua saindo pelo Twilio**: a caixa de entrada (`/inbox`), o botão de WhatsApp nas entidades (lead, contato, empresa, negócio), campanhas de WhatsApp, sequências de sourcing e a régua de cobrança.
- Templates: as telas de campanha e do diálogo de envio leem a lista antiga do Twilio, não os templates aprovados na Meta.
- Nenhuma conta/número Meta conectado ainda (0 contas, 0 números); as 6 conversas e 15 mensagens existentes são todas Twilio.
- A janela de conexão da Meta (aquela do print, "Login do Facebook para Empresas") **não existe** — hoje a conexão é manual, colando WABA ID e token. Isso fica fora deste plano, para uma fase seguinte.

## O que vamos fazer

Trocar o motor de envio de WhatsApp do Twilio para a API oficial da Meta, mantendo todas as telas e funcionalidades como estão, com múltiplos workspaces/clientes cada um com seu próprio número.

1. **Escolha automática do canal por workspace**
   - Todo envio passa a sair pela Meta; o Twilio é removido do WhatsApp. Workspace sem número Meta conectado recebe aviso claro para conectar em Configurações, em vez de enviar por outro canal.
   - Quando há mais de um número no workspace, usa o número padrão definido nas configurações; a conversa já existente mantém o número usado anteriormente.

2. **Envio unificado**
   - Um único caminho de envio passa a atender caixa de entrada, botão nas entidades, campanhas, sequências de sourcing e cobrança.
   - Texto livre dentro da janela de 24h; fora da janela, exige template aprovado (com aviso claro na tela em vez de erro genérico).
   - Anexos (imagem, PDF, áudio) enviados pela Meta.
   - Registro na conversa, no histórico de mensagens e na timeline do contato continua igual, com o identificador da Meta e o status (enviado, entregue, lido, falhou) atualizado pelo webhook.

3. **Templates oficiais nas telas**
   - Diálogo de envio e campanhas passam a listar os templates aprovados na Meta do workspace, com as variáveis posicionais que a Meta exige.
   - Templates antigos do Twilio continuam visíveis apenas para workspaces sem Meta.

4. **Limites e conformidade multi-cliente**
   - Cada workspace só envia pelos próprios números (isolamento já garantido por RLS; será revalidado).
   - Limite de números por workspace respeitando o plano contratado.
   - Marcar a mensagem como lida na Meta ao abrir a conversa, para métricas corretas.

5. **Validação**
   - Conectar um número real (WK Technology) e testar: receber, responder dentro da janela, enviar template fora da janela, anexo, status de entrega, campanha pequena e cobrança.

## Detalhes técnicos

- Novo resolvedor de canal (`provider`) em módulo server-only, consultando `wa_phone_numbers`/`wa_business_accounts` do workspace ativo; `sendWhatsAppMessage` em `src/lib/whatsapp.functions.ts` passa a delegar para Meta ou Twilio mantendo a mesma assinatura, para não alterar chamadores.
- `src/lib/whatsapp-send.server.ts` (cobrança/cron) ganha o mesmo resolvedor.
- Envio de mídia e `mark_as_read` adicionados em `src/lib/whatsapp-meta.functions.ts`; status por `wamid` no webhook `src/routes/api/public/meta/whatsapp-webhook.ts`.
- Campanhas (`campaigns.whatsapp.tsx` + `whatsapp-campaign-tick.ts`) e `send-whatsapp-dialog.tsx` passam a ler `listTemplates` da Meta.
- Sem alteração de schema além de colunas auxiliares se necessário (`provider`/`wa_message_id` já existem); sem mudança de RLS, permissões ou regra de negócio. Nenhuma Edge Function.
- Validação: `bun run typecheck`, `bun run lint`, `bun run test`.

## Fora do escopo (fase seguinte, se você quiser)

Janela de conexão da Meta (Embedded Signup) para os clientes conectarem o número deles sem colar token — exige configurar o app da Meta como Tech Provider e revisão da Meta.
