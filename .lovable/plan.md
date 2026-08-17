# Corrigir a abertura do modal de qualificação

## O que está acontecendo

A fila de automações do workspace está entupida. O backfill de etapas dos leads (executado às 15:12) atualizou milhares de leads e cada atualização gerou eventos de automação: hoje existem **11.632 eventos, dos quais 11.108 continuam sem processar** (11.100 do tipo "atualizado", vindos do backfill).

O motor processa a fila **do mais antigo para o mais novo, 50 por vez**. Quando você move o lead para "Em qualificação", o evento novo entra no fim de uma fila de 11 mil itens, o workflow "Pesquisa de qualificação ao entrar em Em qualificação" não roda em tempo, a tela não encontra pesquisa pendente e mostra o aviso "Etapa atualizada. Nenhuma pesquisa pendente foi criada pelo workflow."

Confirmado no banco: o workflow está publicado e ativo, o evento `stage_changed` do lead atual foi gerado corretamente (`stage_id` de `new` para `qualifying`), mas ficou com `processed_at` nulo.

Também foi encontrado um problema estrutural: as tabelas de leads, contatos, empresas e negócios têm **dois gatilhos idênticos** de enfileiramento (`leads_wf_event` e `trg_wf_events_leads`, etc.), então **todo evento é criado em duplicidade** — dobrando fila, execuções e risco de ação repetida.

Observação não confirmada: os eventos mostram o lead indo para "Em qualificação" e voltando para "Novo" quatro vezes entre 15:14 e 15:15. O mais provável é que sejam suas próprias tentativas manuais de repetir o teste; nenhum código de gravação automática foi identificado. Isso será verificado após a correção da fila.

## Correção proposta

1. **Limpar a fila do backfill** (migration de dados): marcar como processados os eventos `updated` de `leads` não processados criados na janela do backfill. São eventos técnicos de correção de dados, não ações de usuário — nenhum workflow deveria reagir a eles. Os eventos `stage_changed` pendentes são preservados.
2. **Remover os gatilhos duplicados** (migration): manter um único gatilho de enfileiramento por tabela em `leads`, `contacts`, `companies` e `deals`.
3. **Priorizar o registro em foco**: `triggerTickNow` passa a aceitar `entity` + `entity_id` opcionais. Quando informados, processa primeiro os eventos pendentes daquele registro e só depois segue a ordem normal da fila. A tela de detalhe do lead passa a informar o lead atual, tornando a abertura do modal imediata mesmo com fila acumulada.
4. **Mensagem mais útil**: se após as tentativas ainda não houver pesquisa, o aviso passa a indicar fila em processamento e oferecer nova tentativa, em vez de afirmar que o workflow não criou nada.

## Detalhes técnicos

- Migration 1: `update public.workflow_events set processed_at = now() where processed_at is null and entity = 'leads' and event_type = 'updated' and created_at >= <início do backfill>`.
- Migration 2: `drop trigger trg_wf_events_leads on public.leads` (idem `contacts`, `companies`, `deals`), mantendo `*_wf_event`. Nenhuma mudança em `enqueue_workflow_event`, RLS, grants ou schema.
- `src/lib/workflows.functions.ts`: `triggerTickNow` recebe `inputValidator` opcional (`entity`, `entity_id`); nova função no engine `tickWorkflowsFor(supabase, entity, entityId, limit)` reusando `processEvent`, chamada antes de `tickWorkflows`.
- `src/lib/workflows/engine.server.ts`: adiciona a varredura filtrada por `entity`/`entity_id`; ordenação e demais comportamentos inalterados.
- `src/routes/_authenticated/leads.$id.tsx`: `tickWorkflows({ data: { entity: "leads", entity_id: lead.id } })` e ajuste do texto/ação do aviso final.
- Sem alteração de RLS, permissões, schema de tabelas ou regras de negócio dos workflows.

## Como validar

1. Mover um lead de "Novo" para "Em qualificação": o modal de qualificação (com Apollo e score ICP) deve abrir em poucos segundos.
2. Conferir em Configurações > Workflows que a execução aparece com sucesso.
3. Conferir que cada mudança de etapa gera **uma** execução, não duas.
