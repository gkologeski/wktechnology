# Qualificação mais compacta + rótulos em PT-BR para valores herdados do HubSpot

Duas frentes independentes, ambas apenas de apresentação (nenhuma mudança de schema, RLS ou regra de negócio).

## 1. Reduzir pela metade o espaço vertical dos campos de qualificação

Alvo: blocos de campos de entidade exibidos antes (e depois) das perguntas, em `src/components/prospecting/qualification-entity-fields.tsx`.

Ajustes de densidade (mantendo tokens semânticos, foco visível e labels):

- container dos blocos: `space-y-4` → `space-y-2`
- cada bloco (`section`): `p-3 space-y-3` → `p-2 space-y-1.5`
- grid de campos: `gap-3` → `gap-x-3 gap-y-1.5`
- cada campo: `space-y-1.5` → `space-y-1`
- inputs/selects/CurrencyInput em altura compacta (`h-8`, texto `text-sm`); checkbox de boolean em linha única com o label
- cabeçalho do bloco com altura reduzida e badge inline sem quebrar linha desnecessariamente
- skeleton de loading atualizado para refletir a nova densidade

Preservado: obrigatoriedade, selo "Apollo", sugestões clicáveis, máscara de moeda, responsividade e dark mode.

## 2. Tradução dos valores em inglês (camada de exibição)

Confirmado no banco: os valores vêm do HubSpot em código (`COMPUTER_SOFTWARE`, `NEW`, `OFFLINE`, `lead`, `PROSPECT`, `non-marketing`) e ainda são sincronizados de volta para o HubSpot (`hubspot-push.server.ts` envia `industry`). Por isso os dados permanecem intactos e a tradução acontece só na exibição.

Novo dicionário `src/lib/i18n/hubspot-values.ts`:

- `INDUSTRY_LABELS` — catálogo completo dos setores HubSpot/LinkedIn (ex.: `COMPUTER_SOFTWARE` = "Software de Computador", `INFORMATION_TECHNOLOGY_AND_SERVICES` = "Tecnologia da Informação e Serviços", `HOSPITAL_HEALTH_CARE` = "Hospitais e Saúde", …)
- `COMPANY_TYPE_LABELS` — `PROSPECT`, `PARTNER`, `RESELLER`, `VENDOR`, `OTHER`
- `LIFECYCLE_LABELS` — `subscriber`, `lead`, `marketingqualifiedlead`, `salesqualifiedlead`, `opportunity`, `customer`, `evangelist`, `other`
- `LEAD_STATUS_LABELS` — `NEW`, `OPEN`, `IN_PROGRESS`, `OPEN_DEAL`, `UNQUALIFIED`, `ATTEMPTED_TO_CONTACT`, `CONNECTED`, `BAD_TIMING`
- `MARKETING_STATUS_LABELS` — `marketing`, `non-marketing`
- `LEAD_SOURCE_LABELS` — `OFFLINE`, `DIRECT_TRAFFIC`, `ORGANIC_SEARCH`, `PAID_SEARCH`, `PAID_SOCIAL`, `EMAIL_MARKETING`, `SOCIAL_MEDIA`, `REFERRALS`, `OTHER_CAMPAIGNS`
- `translateFieldValue(fieldKey, value)` — resolve pelo nome da coluna (`industry`, `type`, `lifecyclestage`, `hs_lead_status`, `marketing_status`, `source`), com fallback: valores já em português ou IDs numéricos de estágio customizado são exibidos como estão; código desconhecido em MAIÚSCULA_COM_UNDERSCORE vira Capitalizado legível.

Aplicação nos pontos de exibição, sem alterar as consultas nem os valores gravados/filtrados:

- lista de Empresas (coluna Setor e facetas de filtro) e detalhe da empresa
- lista de Contatos (estágio do ciclo de vida) e detalhe
- Leads (origem) e painel de qualificação
- `PropertiesPanel` / catálogo de campos, para que qualquer campo listado use o rótulo traduzido na visualização e nas opções de select

## Detalhes técnicos

- Nenhuma migration, nenhum `UPDATE` em dados; filtros continuam enviando o código original ao banco (`.in("industry", …)`), apenas o texto exibido muda.
- Novo módulo puro em `src/lib/i18n/hubspot-values.ts` + testes unitários em `src/lib/i18n/__tests__/hubspot-values.test.ts` cobrindo tradução conhecida, fallback de valor em PT, ID numérico e código desconhecido.
- Validações a rodar no fim: testes unitários da nova suíte e typecheck.
