# Nome do cliente associado na Inbox do WhatsApp + sugestão da empresa de origem

## O que muda
1. **Nome no lugar do número** nas três áreas marcadas:
   - item da lista de conversas;
   - cabeçalho da conversa;
   - painel lateral (iniciais e título).
   Quando a conversa tem Contato ou Lead associado, aparece o nome (ex.: "Kiver Silva"). O telefone continua visível logo abaixo (lista: no subtítulo; cabeçalho: "WhatsApp · +55… · via …"; painel: abaixo do nome). Sem associação, segue mostrando o telefone como hoje.
   Ao associar ou trocar a associação, o nome atualiza na hora, sem recarregar.
2. **Sugestão da empresa de origem.** Quando a conversa não tem contato/lead e veio de uma campanha cujo público era uma Empresa, o painel "Cliente associado" mostra: "Origem da campanha: <Empresa>" com logotipo, e o campo de busca já filtra contatos dessa empresa. A associação continua sendo escolha sua — nada é criado nem vinculado automaticamente.

## Fora do escopo
- Criar contato/lead automaticamente, alterar permissões ou o layout geral da Inbox.
- E-mail e Chat ao vivo (já mostram nome/e-mail do visitante).

## Detalhes técnicos
- Nomes: hook `useInboxIdentityNames(conversations)` busca em lote (`contacts`/`leads` `in(id)`, cliente do navegador com RLS) só os ids da página visível; `queryKey` inclui os ids e é invalidado junto com `["inbox-channel","whatsapp"]` no `onLinked`. Sem mudança no RPC `get_inbox_channel_page`.
- Sugestão: nova server fn autenticada `getWhatsAppConversationOrigin({ conversationId })` que lê a conversa pelo cliente do usuário (RLS), procura o destinatário de campanha do mesmo workspace pelas variantes do telefone (`brPhoneVariants`) e, se `variables._source` for `company:<id>`, devolve `{ companyId, name, logo }` da empresa visível ao usuário. `InboxIdentityLinker` recebe a sugestão e repassa um filtro `company_id` ao `EntityCombobox` quando suportado.
- Sem migration.

## Validação
- Teste unitário do mapeamento de nome (contato > lead > telefone).
- Typecheck, lint e testes de inbox/WhatsApp com resultados reais.
- Playwright com sessão real em `/inbox/whatsapp`: conversa associada mostra o nome nos três lugares; conversa da campanha com origem Empresa mostra a sugestão.
- Nada enviado nem publicado.
