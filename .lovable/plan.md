# Link do contato na Inbox + controle de reenvio em campanhas

## Parte 1 — Nome do cliente vira link (painel direito da Inbox WhatsApp)
- O nome em destaque (ex.: "Paulo Fontes") passa a ser um link para a ficha.
- Associada a Contato: abre o contato. Só Lead: abre o lead. Sem associação: continua texto.
- Sublinhado ao passar o mouse, foco visível e descrição acessível ("Abrir contato Paulo Fontes").

## Parte 2 — Não repetir disparos recentes em campanhas
- Cada campanha (WhatsApp agora; e-mail no mesmo padrão) ganha o campo **"Não enviar para quem recebeu nos últimos N dias"**, padrão 7 dias (0 desliga).
- Conta só o **mesmo canal**: WhatsApp recente bloqueia WhatsApp; e-mail bloqueia e-mail.
- Na montagem do público aparece um aviso: "X contatos retirados por envio recente", com a lista (nome, data e campanha do último envio).
- **Exceção manual**: você pode marcar contatos retirados e incluí-los mesmo assim; a inclusão fica registrada.
- O servidor confere de novo na hora do envio: quem recebeu mensagem de outra campanha depois da montagem é pulado com o motivo "Envio recente".
- Envios já feitos não mudam; nada será disparado durante a implementação.

## Fora do escopo
- Lista de conversas e cabeçalho da conversa; mensagens manuais da Inbox (não contam como campanha).

## Detalhes técnicos
- Parte 1: `Link` do TanStack em `inbox.whatsapp.tsx` (`/contacts/$id` prioritário, `/leads/$id`), confirmando a rota de lead.
- Parte 2: migration aditiva com `whatsapp_campaigns.recent_contact_days int default 7` e `email_broadcasts.recent_contact_days int default 7`, mais `override_recent boolean default false` nos destinatários. Verificação por variantes de telefone (`whatsapp_campaign_recipients` com status enviado, mesmo workspace) e por e-mail (`email_broadcast_recipients`), em `campaign-audience.server.ts` ao salvar e no disparo antes de cada envio. Sem tocar RLS; consultas pelo cliente do usuário.
- Testes unitários da regra: dentro do período retira; fora inclui; exceção manual inclui; outro canal não bloqueia.

## Validação
- Typecheck, lint e testes com resultados reais.
- Playwright: clicar no nome abre a ficha; montar público de campanha em rascunho mostra os retirados. Sem enviar nem publicar.
