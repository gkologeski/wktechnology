# Alinhar o cadastro de Lead à sequência de enriquecimento

## Sequência de enriquecimento (Apollo) — referência

1. Resolver **domínio** da empresa sem gastar crédito: site/domínio da empresa → domínio do e-mail corporativo.
2. Sem domínio: buscar empresa por nome (`mixed_companies/search`, 1 crédito/página) — último recurso.
3. Enriquecer **Empresa**: `organizations/enrich?domain=` (1 crédito).
4. Enriquecer **Pessoa**: `people/match` com o melhor sinal disponível — `id` Apollo → `linkedin_url` → e-mail corporativo → nome + domínio → nome + empresa.
5. Telefone/celular chegam depois (assíncrono, via webhook).

## O que o cadastro de Lead coleta hoje (verificado)

`src/components/leads/create-lead-dialog.tsx`, nesta ordem:
Nome* → Sobrenome → E-mail → Telefone → Empresa (picker) → Fonte.

`QuickCreateCompanyDialog` (`src/components/record/quick-create-dialogs.tsx`) coleta Nome e **Domínio** — mas não Site.

## Divergências encontradas

1. **Não existe campo de LinkedIn no cadastro**, apesar de `leads.linkedin_url` existir e ser o **sinal de maior precisão** do `people/match`. Hoje o LinkedIn só pode ser informado depois, no painel de qualificação.
2. **O domínio/site da empresa não é pedido no fluxo do lead.** Quando o usuário seleciona uma empresa existente sem domínio, ou cria uma empresa nova sem preencher o domínio, o passo 1 falha e a cascata cai na busca por nome (crédito) ou no sinal fraco nome+empresa.
3. **Ordem invertida em relação ao valor de enriquecimento**: Telefone (campo que o Apollo preenche depois, de forma assíncrona) vem antes de Empresa, e os dois sinais fortes (LinkedIn e domínio) não aparecem. O usuário digita justamente o que a integração traria e omite o que ela precisa.
4. `src/lib/workflows/entity-field-order.ts` (ordem canônica de `leads`) também não inclui `linkedin_url` nem `mobile_phone`, embora ambos existam na tabela e no grid (`BASE_LEAD_KEYS`).

## Ajustes propostos

### Ordem do formulário de criação de lead

Nome* → Sobrenome → **LinkedIn** → E-mail → Telefone → Empresa → **Site/domínio da empresa** (visível quando a empresa selecionada/nova não tem domínio) → Fonte.

Racional: primeiro os sinais que identificam a pessoa e a empresa (LinkedIn, e-mail, domínio); depois os dados que o enriquecimento pode preencher.

### Detalhes

- Campo **LinkedIn** com normalização por `src/lib/prospecting/linkedin-url.ts` (aceita colagens com `www`, `http`, parâmetros de rastreio; recusa `/company/` e posts), erro inline e gravação em `leads.linkedin_url`.
- Campo **Site/domínio da empresa** só aparece quando a empresa escolhida não tem `domain`; ao salvar, grava `companies.domain` apenas se estiver vazio (nunca sobrescreve).
- Incluir `domain`/`website` no `select` do `CompanyPicker` para saber se o campo deve aparecer.
- Adicionar `linkedin_url` e `mobile_phone` à ordem canônica de `leads` em `entity-field-order.ts`, na mesma sequência do formulário.
- Uma dica curta abaixo do LinkedIn explicando que ele melhora o enriquecimento — sem prometer que o enriquecimento acontece no cadastro (ele continua na qualificação).

### Fora do escopo

Não altera a cascata do Apollo, o questionário, o score, RLS/permissões nem o schema (as colunas já existem). Sem enriquecimento automático no momento do cadastro.

## Arquivos previstos

- `src/components/leads/create-lead-dialog.tsx` — nova ordem + campos LinkedIn e domínio.
- `src/components/record/quick-create-dialogs.tsx` — expor `domain` no picker de empresa (ajuste mínimo).
- `src/lib/workflows/entity-field-order.ts` — ordem canônica de `leads`.

Validação: `bun run lint`, `bun run typecheck`, `bun run test`.
