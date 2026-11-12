# CANAIS-ARQUIVADOS — números desconectados vão para "Arquivados"

**Porte P/M · estimativa 2–3 h** (banco, servidor, tela, testes, Ajuda e permissões).

## Causa confirmada
- A conexão da Bruna (+55 48 6136-5335) foi excluída, mas o botão **Atualizar contas** procura números também nas conversas antigas do WhatsApp. Existem 1.014 conversas desse número no histórico, então ele volta para a lista toda vez.
- A tela não tem a ideia de "número arquivado": tudo que existe aparece como ativo.

## O que vai mudar para o usuário
1. Em **Configurações › Canais de atendimento › WhatsApp**, a lista principal mostra só os números conectados.
2. Abaixo, uma seção recolhida **"Arquivados (N)"** mostra os números desconectados, apenas para consulta: nome, número, data em que foi arquivado e quantas conversas tem. Sem edição, sem vínculo a agente.
3. O contador do cartão "WhatsApp" passa a contar só os conectados.
4. **Atualizar contas** nunca reativa um número desconectado: números encontrados só no histórico entram direto como arquivados.
5. Se um número arquivado voltar a ser conectado na Meta, ele sai do arquivo sozinho na próxima atualização.
6. A Bruna (6136-5335) passa a aparecer só em Arquivados. Conversas e mensagens continuam intactas.

## Regras
- **Conectado** = número com conexão ativa (Meta com situação conectada, ou a conexão legada que a Lia usa hoje — vou conferir no banco antes de mudar, para a Lia não ser arquivada por engano).
- Número arquivado não recebe nem envia pela Lia/agentes; o vínculo com agente fica guardado, mas desligado.
- Nada é apagado; o arquivo serve para histórico.

## Detalhes técnicos
- Migração aditiva: `service_channel_accounts.archived_at timestamptz null` (+ índice parcial por workspace onde nulo). Sem alterar RLS existente.
- `discoverServiceChannels`: classifica cada número (ativo vs só histórico); upsert passa a atualizar `archived_at` (arquiva o que não está ativo, desarquiva o que voltou). Gravação continua após `requireChannelAccess(manage)`.
- `listServiceChannels`: retorna `archived_at` e contagem de conversas por número arquivado.
- Runtime do canal (`channel-runtime.server.ts`) ignora contas arquivadas ao escolher remetente.
- Tela `settings.channels.tsx`: separa ativos/arquivados; seção arquivada usa `EmptyState` e componentes oficiais; somente leitura.
- Reaproveita as permissões `system.channels.view/manage.workspace` (mesmo recurso); contrato em `permission-contracts.json` atualizado; teste da regra de classificação (conectado, só histórico, reconectado).
- Ajuda: artigo dos Canais de atendimento ganha a seção "Números arquivados" (bump de versão).

## Validação
- Clicar em **Atualizar contas** no preview e confirmar: 4 números ativos (incluindo a Lia) e a Bruna em Arquivados.
- `permissions:check`, testes do canal e `help:coverage`.
