# Associações do Lead: completar o que hoje não aparece

## Situação atual (verificada no código)

Na criação do lead, `src/lib/leads/lead-relations.ts` já garante **Empresa** e **Contato**
(reaproveitando registros do workspace, idempotente) e é chamado nos vários pontos de
criação (modal, API pública, formulários, MCP, IA, workflows, importações).

No detalhe do lead (`src/routes/_authenticated/leads.$id.tsx`), o painel direito
(`AssociationsPanel entity="lead"`) exibe apenas:

- Empresa (`CompanyCard`)
- Contato vinculado (`LeadContactsCard`)
- Negócio convertido (`LeadDealsCard`)
- Tarefas abertas, E-mails recentes e Anexos — todos derivados de `activities.related_lead_id`

## Entidades que se relacionam com lead e hoje NÃO aparecem

Tabelas com coluna de lead confirmadas no schema, sem nenhuma exibição no detalhe do lead:

| Entidade | Coluna | Situação |
| --- | --- | --- |
| Reuniões (`meetings`) | `related_lead_id` | `MeetingsPanel` existe e já aceita `entity: "lead"`, mas **não é importado em nenhuma tela** |
| Ligações (`prospecting_call_attempts`) | `lead_id` | `CallHistoryPanel` existe, aceita lead, **não é importado em nenhuma tela** |
| Formulários (`form_submissions`) | `lead_id` | Nenhuma exibição a partir do lead |
| Agendamentos (`bookings`) | `lead_id` | Nenhuma exibição |
| Threads de e-mail (`email_threads`) | `lead_id` | Só aparecem e-mails vindos de `activities` |
| Campanhas de e-mail (`email_broadcast_recipients`) | `lead_id` | Nenhuma exibição |
| Prospecção (`prospecting_results`, `sdr_enrollments`, `task_queue_items`) | `lead_id` | Nenhuma exibição |
| Atribuição (`attribution_touchpoints`) | `lead_id` | Nenhuma exibição |

Sentido inverso (lead visto de outra entidade):

- Contato e Empresa **já** mostram os leads (`RecordLeadsCard`).
- **Negócio** não mostra o lead de origem, apesar de `leads.converted_deal_id` existir.
- **Chamado** (`tickets`) não tem coluna de lead — relação só indireta via atividades.

## Mudanças propostas

### Fase 1 — Detalhe do lead: cards de alto valor

Novos cards de associação para o lead, seguindo `AssocCard`/`Empty`/`ViewAllFooter`
(loading, empty, error, dark mode, tokens semânticos):

1. **Reuniões** — reaproveitar `MeetingsPanel` (`entity="lead"`), sem novo componente.
2. **Ligações** — reaproveitar `CallHistoryPanel` (`entity="lead"`).
3. **Formulários enviados** — origem do lead: formulário, data e link para a submissão.
4. **Agendamentos** — reuniões marcadas via página pública de booking.

### Fase 2 — Detalhe do lead: cards de marketing e prospecção

5. **E-mails (thread)** — passar a somar `email_threads.lead_id` ao card atual, para
   e-mails que não geraram atividade.
6. **Campanhas** — envios de `email_broadcast_recipients` com status.
7. **Prospecção** — resultado de busca de origem, cadências (`sdr_enrollments`) e filas
   de tarefas em que o lead está.

### Fase 3 — Sentido inverso e vínculo manual

8. **Negócio** passa a exibir card "Lead de origem" (via `leads.converted_deal_id`).
9. **Vínculo manual pós-cadastro**: no card de Negócio do lead, permitir vincular um
   negócio existente (hoje só é possível criar via conversão), com a mesma mecânica de
   propagação retroativa de histórico já usada em `propagateAssociationHistory`.

### Fase 4 — Revisão e validação

Typecheck, lint, testes, revisão de escopo e conferência manual em lead novo e lead antigo.

## Detalhes técnicos

- Novos cards em `src/components/record/associations/lead-cards.tsx` (ou arquivo irmão
  `lead-extra-cards.tsx` se o arquivo crescer demais), carregados com `lazy` no
  `associations-panel.tsx`, como os demais cards exclusivos de lead.
- Leituras somente com o client autenticado do browser (RLS do usuário); nenhum
  `client.server` nem consulta com privilégio elevado.
- Sem alteração de schema, RLS, GRANT, permissões ou regra de negócio. Nenhuma coluna
  nova: todas as relações já existem.
- `MeetingsPanel` e `CallHistoryPanel` são usados como estão, sem alteração de API.
- Nenhuma funcionalidade atual é removida; os cards existentes permanecem.

## Como validar

1. Abrir um lead que veio de formulário público: card "Formulários" mostra a submissão.
2. Criar reunião a partir do lead: aparece no card "Reuniões".
3. Lead com tentativa de ligação em campanha de prospecção: aparece em "Ligações".
4. Lead incluído em cadência/fila: aparece no card "Prospecção".
5. Converter lead em negócio e abrir o negócio: card "Lead de origem" preenchido.
6. Lead sem nenhuma dessas relações: todos os cards em estado vazio, sem erro.
