# Entrega do negócio (TechProjects ciclo 2)

Negócio ganho → projeto de entrega em `planning`, criado ou vinculado, sem contrato
obrigatório, sem ativar equipe, cobrança ou contas. Migração:
`drizzle/migrations/0172_techprojects_cycle2_deal_delivery.sql`.

## Modelo

| Peça                         | Papel                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `projects.deal_id`           | negócio de origem principal; `delivery_group_key` diz qual entrega o projeto atende      |
| `projects.source_line_item_id` | item do negócio de origem quando a entrega tem um só item                             |
| `projects.client_contact_id` | contato principal herdado do negócio                                                    |
| `projects.origin`            | `deal_auto`, `deal_manual`, `deal_history`, `manual`, `internal`; `NULL` = anterior     |
| `project_deal_links`         | negócios consolidados num projeto já existente (sem trocar a origem principal)          |
| `deal_delivery_items`        | grupo de entrega explícito por item (`none` = fora); quantidade nunca multiplica        |
| `deal_delivery_policies`     | política por workspace: ligada, marco `activated_at`, origens, criador, responsável     |
| `deal_delivery_jobs`         | fila durável: retry com backoff, lease de 5 min, erro visível, `UNIQUE(deal, transição)` |
| `deal_delivery_events`       | auditoria antes/depois, revisões (`needs_review`) e reversão                            |
| `deal_delivery_worker_state` | último ciclo do agendador (sem dado de tenant)                                          |

Únicos: `projects(deal_id, delivery_group_key)`, `project_deal_links(deal_id, delivery_group_key)`,
um job aberto por negócio. Toda criação/vínculo passa por trava consultiva por negócio.

## Fluxo

```text
deals UPDATE/INSERT (stage/stage_id/pipeline/deleted_at/company)
  → zz_deal_delivery_transition: tipo real da etapa (pipelines.stages[].type, inclusive personalizada)
  → entrou em ganho e política ligada → deal_delivery_jobs (origem user|system|workflow|import)
      ↳ ganho anterior ao marco (insert/import) ou origem desligada → "skipped", nada criado
  → pg_cron "deal-delivery-jobs" a cada 2 min → deal_delivery_run_jobs → deal_delivery_attempt
  → deal_delivery_ensure_internal: 1 projeto por negócio (ou por grupo), já existente = reaproveita
saiu de ganho → jobs abertos cancelados + revisão se havia projeto (nada é apagado)
empresa do negócio mudou com projeto ligado → revisão (nenhuma troca automática)
```

A venda nunca é desfeita por falha da preparação: o erro fica no job, aparece no negócio
("Reprocessar") e o agendador tenta de novo com backoff até `max_attempts`.

Origem: sessão de usuário = `user`; `app.deal_origin`/cabeçalho `x-techerp-origin` define
`import|workflow|system`; gravação com `hs_raw` novo (HubSpot) = `import`; o resto = `system`.
Gravações feitas por passos de workflow que mudam a etapa contam como `system`; a ação
`ensure_deal_delivery` é a origem `workflow`.

## Autorização

- Ações do usuário (`deal_delivery_create_project`, `_link_project`, `_unlink_project`,
  `_set_groups`, `_retry`, `_set_operational_owner`, `_resolve_review`): workspace ativo,
  membership ativo, Ver como somente leitura, e permissão de **origem e destino**
  (editar o negócio pelo escopo comercial e editar o projeto pelas permissões do TechProjects).
- Leituras (`deal_delivery_overview`, `project_delivery_origin`) não devolvem valor/custo do
  negócio; negócio sem acesso aparece como "sem acesso", sem nome.
- Política e histórico: só administrador ativo (`project_recon_assert_admin`).
- Gravação direta de `projects.deal_id/origin/...` pelo navegador é recusada pelo gatilho.
- Agendador e ação de workflow só executam sem sessão de usuário (service role / pg_cron).
- Projetos criados não concedem membership, papel ou permissão; o vendedor nunca vira gestor.
  Responsável operacional vazio = pendência visível.

## Histórico (Conciliação › Negócios)

- Lista ganhos com/sem projeto, contratos, serviços, natureza (hunting, recorrente, aditivo,
  cliente recorrente) e até 8 candidatos explicados.
- Automático só chave exata (contrato do negócio ou serviço do item ligados ao projeto),
  candidato único dos dois lados e mesma empresa. Mesma empresa/período = sugestão.
- Lote: prévia com snapshot por par; se algo mudou, o lote inteiro é recusado (40001).
- "Criar projeto faltante" explícito, até 25 negócios por vez, com justificativa.
- Desfazer remove só vínculos intactos; nunca apaga projeto, horas ou contrato.

## Estado no WK (20/10/2026)

Política ligada às 17:25 (horário de Brasília) por um administrador, origens tela/API/workflow,
importação desligada, sem responsável padrão. Agendador `deal-delivery-jobs` ativo no banco
(não depende de publicação). As telas novas só chegam à versão publicada depois de publicar.
Antes da ativação: 426 ganhos, 0 com projeto, 0 pares de chave exata.

## Provas

`tests/sql/deal-delivery-isolated.sh` (banco descartável; 83 asserções: política/ativação sem
replay, etapa personalizada, idempotência, concorrência, retry, RLS/escopo/deny/inativo/
outro workspace/Ver como, histórico, hashes). Testes unitários em `src/lib/projects/deal-delivery.test.ts`.
