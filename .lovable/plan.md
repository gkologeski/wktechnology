# NUMERO-FANTASMA — tirar o +55 48 6136-5335 de Canais de atendimento

Porte P, cerca de 40 min.

## O que acontece hoje (confirmado)
- Ontem a conexão da Bruna foi excluída. Hoje às 00:06 UTC ela voltou a ser criada, sem configuração ("Configuração não aplicada").
- Quem a recria é o botão "Atualizar contas" de /settings/channels. Ele procura números em três lugares: e-mails, números da Meta e **conversas antigas** do WhatsApp. As conversas antigas da Bruna continuam guardadas (de propósito), então o número volta sempre que alguém clica em atualizar.
- A própria tela já sabe que o número não existe: mostra "Número não disponível na conexão Lovable atual".

## O que vou fazer
1. **Parar de recriar:** na busca por conversas antigas, só cadastrar o número se ele for o número conectado hoje no WhatsApp do Lovable. Números de conexões apagadas deixam de voltar. Números da Meta e e-mails continuam como estão.
2. **Remover de novo o cadastro recriado** do +55 48 6136-5335 (sem atendimento ligado, só a linha da tela), guardando cópia antes.
3. Conversas, mensagens e contatos da Bruna continuam intactos.

## Conferências
- Teste automático: conversa antiga de número que não é o conectado não gera conta; o número conectado continua gerando.
- Na tela, com a sua conta: clicar em "Atualizar contas" e ver que o número não volta.
- Checagem de permissões (sem mudança de quem pode o quê) e artigo da Ajuda de canais atualizado se mencionar a busca.

## Detalhes técnicos
- `src/lib/prospecting/sdr/channel-accounts.functions.ts` › `discoverServiceChannels`: no bloco legado de `whatsapp_conversations`, obter o `phoneNumberId` atual do conector (mesma fonte de `getWhatsAppConnection`) e só fazer push quando `wa_phone_number_id` for igual; sem conexão atual, não adicionar legados.
- Excluir `service_channel_accounts` id `8d1a54d5-c420-42d9-92f5-882fb34bb676` após conferir que não há `service_channel_bindings`/sessões ligados; backup em `.lovable/backups/`.
- Atualizar hash em `docs/security/permission-contracts.json`.
