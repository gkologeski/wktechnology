# Ciclo 3 — Parte A: linha do tempo completa

Objetivo: a linha do tempo de leads, contatos, empresas, negócios e tickets mostra **todo** o histórico em páginas de 40 itens, com atividades, alterações de campos e reuniões da agenda na mesma sequência. Contagens e busca valem para o conjunto inteiro, não só para o que já está na tela.

## O que muda para o usuário
- "Carregar mais" passa a trazer também alterações de campos e reuniões, até o fim do histórico. Os cortes de 300 itens acabam.
- A busca encontra alterações de campos e conteúdo de e-mail que ainda não foram carregados.
- Os números de cada filtro (ligações, e-mails, alterações etc.) refletem o total real.
- O corpo, os anexos e o rastreamento de e-mail carregam só ao expandir o item, com aviso de carregando e de erro.
- Quando outra pessoa altera algo, a lista se atualiza no lugar. A posição de rolagem, as páginas já abertas e os rascunhos são mantidos.

## Etapas
1. **Uma única função de feed no banco** (nova, aditiva; a atual continua disponível):
   - Junta as três origens: atividades, grupos de alterações de campos e reuniões da agenda.
   - Cada grupo de alterações (mesmo autor e momento) conta como um item e nunca é dividido entre páginas.
   - Reuniões da agenda que já existem como atividade são removidas antes de paginar.
   - A ordem segue a mesma data usada hoje e, em caso de empate, a origem e o ID.
   - Filtros de período, categoria, responsável e busca são aplicados antes de paginar.
   - Retorna um total exato e as contagens por categoria.
   - As regras de acesso do usuário logado continuam valendo; a função não usa privilégios especiais.
2. **E-mail sob demanda:**
   - A página traz só um resumo do e-mail (assunto, remetente, prévia).
   - Uma consulta separada e protegida traz corpo, anexos e rastreamento quando o item é expandido.
3. **Cliente:**
   - A busca de páginas fica guardada separadamente para cada combinação de registro, filtros, área de trabalho, usuário e modo "Ver como".
   - Respostas que chegam depois de uma troca de contexto são descartadas.
   - Ao receber uma mudança em tempo real, as páginas já carregadas são recarregadas e mescladas sem duplicar itens, em vez de voltar para a primeira página.
4. **Testes:**
   - Teste no banco com dados temporários desfeitos ao final: mais de 300 alterações, datas empatadas, grupos na fronteira entre páginas, reunião duplicada, busca em histórico e em e-mail, filtros e caso vazio.
   - Teste com sessão de usuário real em dois cenários: uma pessoa com escopo próprio e alguém de outra área de trabalho, que não pode ver nada.
   - Testes de cliente para a mesclagem, o descarte de respostas antigas e a preservação dos rascunhos.
5. **Medição e relatório:**
   - Antes e depois na mesma ficha autenticada: número de consultas, bytes e plano da consulta completa.
   - Rodar verificação de tipos, lint, suíte completa e build.
   - Atualizar `performance-cycle-3.md` e o backlog, separando o que foi feito, o que foi validado e o que ficou pendente.

Fora deste plano: dashboard (parte B) e Inbox (parte C), que virão em planos seguintes após a validação de A.

## Detalhes técnicos
- Nova RPC `get_timeline_feed_page` (SECURITY INVOKER, `search_path=public`):
  - CTEs `acts` (de `activities` com `deleted_at IS NULL`), `hist` (de `property_history` agrupado por `entity`, `entity_id`, `changed_by` e `date_trunc('second', changed_at)`) e `cal` (de `calendar_events` vinculados, excluindo os que têm atividade com o mesmo id externo).
  - União em `feed(source, id, effective_at, category, payload)`.
  - Cursor `(effective_at, source_rank, id)`, sem limite fixo de linhas.
  - Índices novos só se o EXPLAIN da consulta final, rodado com papel `authenticated`, indicar necessidade.
- Lógica de agrupamento e deduplicação: replicar a regra atual de `use-timeline-feed.ts` e `history-timeline-item`. Se houver divergência, documentar.
- Nova server function ou RPC `get_email_detail(activity_id)`, sujeita às regras de acesso, consumida em `ActivityTimelineItem`.
- `use-timeline-feed.ts`: guardar as páginas carregadas e, no evento de tempo real, refazer as N páginas até o cursor atual e substituir de uma vez. O estado de edição fica fora da lista de itens.
- Rollback: o cliente volta à RPC da 0087, que é mantida. A nova função e os índices podem permanecer sem efeito.
