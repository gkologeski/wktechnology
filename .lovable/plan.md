# Funil de Leads refletido na entidade Leads

Hoje as telas de Leads usam uma lista fixa de 4 status no código (Novo, Contatado, Qualificado, Desqualificado) e ignoram o funil configurado em Pipelines. O funil do workspace ("Funil de Leads": Novo, Em Contato, Desqualificado, Qualificado, Oportunidade) nunca aparece no detalhe nem na lista, mesmo já existindo os campos `pipeline_id` e `stage_id` na tabela de leads.

## O que será feito

1. **Fonte única de etapas**: criar um hook/util compartilhado que lê o funil de Leads configurado (entidade `lead`) e devolve as etapas com rótulo, cor e tipo. Sem funil cadastrado, mantém as etapas padrão apenas como fallback técnico.
2. **Detalhe do Lead**: a trilha de etapas passa a exibir exatamente as etapas do funil configurado, com as cores definidas no funil. Ao clicar em uma etapa, o lead grava a etapa escolhida (`stage_id` + `pipeline_id`) e a tela atualiza sem recarregar.
3. **Compatibilidade do status legado**: como `status` é um campo de tipo restrito usado em filtros e relatórios, ele continua sendo preenchido de forma derivada da etapa (etapa com o mesmo código mantém o valor; etapas customizadas caem no valor equivalente mais próximo pelo tipo da etapa: aberto → contatado, ganho → qualificado, perdido → desqualificado). Nada disso muda regra de negócio, apenas mantém filtros existentes funcionando.
4. **Lista de Leads**: o seletor de filtro por etapa e o selo de etapa na tabela passam a usar os rótulos e cores do funil configurado, em vez da lista fixa.
5. **Remover as regras automáticas** (conforme solicitado — automações passarão a ser feitas por Workflows):
   - mover o lead para "Qualificado" deixa de abrir automaticamente o modal de criar negócio;
   - a ação "Converter" continua disponível como ação manual explícita no menu do lead e no detalhe (botão), sem gatilho automático;
   - nenhuma outra alteração de estado passa a acontecer implicitamente ao trocar a etapa.

## Fora do escopo

- Não altera o cadastro/edição do funil em Configurações → Pipelines.
- Não altera RLS, permissões nem o schema do banco.
- Não remove nenhuma funcionalidade além dos gatilhos automáticos citados no item 5.

## Detalhes técnicos

- Novo módulo `src/lib/leads/stages.ts` + hook baseado em `usePipelines("lead")` (já existente em `src/lib/pipelines.ts`), com `resolveLeadStage(lead)` usando `stage_id` e caindo para `status` em leads antigos.
- `src/routes/_authenticated/leads.$id.tsx`: `StageTracker` alimentado pelas etapas do funil; `setStatus` vira `setStage` gravando `stage_id`, `pipeline_id` e `status` derivado; remoção do disparo automático de `CreateDealFromLeadDialog` (o diálogo permanece, acionado por botão).
- `src/routes/_authenticated/leads.tsx`: `StatusPill` e o filtro de etapas passam a receber as etapas do funil; o filtro continua consultando `status` derivado para não quebrar a query tipada.
- Sem migration. Existem funções de banco `auto_advance_lead_stage` / `auto_advance_lead_on_inbound_email`; elas não serão mexidas nesta entrega para evitar regressão — se você quiser desativá-las também, faço em uma etapa separada com confirmação.
- Validações: `bun run typecheck`, eslint nos arquivos alterados e verificação visual do detalhe e da lista de Leads (light/dark, loading/empty/error preservados).
