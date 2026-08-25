# Nova tela de busca de prospects (estilo Apollo)

Substituir o modal atual — que hoje só tem campos de texto livre sem indicação de opções — por uma tela de busca dedicada, com filtros visuais no padrão Apollo: campos básicos sempre visíveis e um painel "Filtros avançados" expansível para refinar a busca.

## Objetivo

- Guiar o usuário mostrando quais valores são aceitos (chips multi-seleção, listas pré-definidas, ranges).
- Manter os filtros básicos sempre à mão e esconder os avançados atrás de um toggle "Mostrar todos os filtros".
- Enviar filtros estruturados para a API do Apollo (arrays reais em `person_titles[]`, `person_seniorities[]`, `organization_num_employees_ranges[]`, etc.) em vez de strings livres.

## UX / Layout

Layout em duas colunas na rota `/prospecting?tab=prospecting` (o modal atual vira uma página lateral / drawer grande):

```text
+----------------------------------------------------+
| Nome da busca                                      |
+---------------- Filtros básicos -------------------+
| Cargos (chips)      | Localizações (chips)         |
| Senioridade (multi) | Setor/indústria (chips)      |
| Porte da empresa    | Palavras-chave (chips)       |
+----------------------------------------------------+
| [ v Mostrar todos os filtros ]                     |
+--------------- Filtros avançados ------------------+
| Departamentos (multi)  | Excluir cargos (chips)    |
| País / Estado / Cidade | Excluir empresas (chips)  |
| Faixa de receita       | Tecnologias (chips)       |
| Status de email        | Domínios permitidos       |
| Máx. resultados        | Instruções extras         |
+----------------------------------------------------+
| Prospects encontrados: N   [ Executar busca ]      |
+----------------------------------------------------+
```

Componentes:

- Cargos, Localizações, Palavras-chave, Setor, Tecnologias, Excluir cargos/empresas, Domínios: `MultiSelectChips` (input com chips, aceita colar lista separada por vírgula).
- Senioridade, Departamentos, Status de email: `Select` múltiplo com valores fixos do Apollo (owner, founder, c_suite, vp, director, manager, senior, entry; sales, marketing, engineering, etc.; verified, guessed, unavailable).
- Porte da empresa e Faixa de receita: multi-seleção de ranges predefinidos ("1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001-10000", "10001+").
- Localização: componente com país, estado e cidade separados (ainda enviado como `person_locations[]`).
- Todos os campos exibem placeholder com exemplo ("ex.: CEO, CTO, Diretor de Vendas") e helper text curto.
- "Mostrar todos os filtros" persiste a preferência via `localStorage`.
- Contador de filtros ativos aparece no botão do toggle ("Filtros avançados · 3").

Estados: loading no botão "Executar busca", empty state quando nenhum resultado, error state com mensagem da Apollo API, disabled do botão quando faltar nome.

## Como funciona por baixo

1. Novo schema estruturado em `prospecting_searches`:
   - Adicionar coluna `filters jsonb not null default '{}'` (aditiva).
   - Manter as colunas atuais (`industry`, `role_title`, `company_size`, `location`, `keywords`) preenchidas com um resumo em texto para compatibilidade com listagens antigas.
2. `src/lib/prospecting.functions.ts`:
   - Estender o Zod schema de `saveProspectSearch` para aceitar `filters` com os campos abaixo, todos opcionais e como arrays de string.
     - `person_titles`, `person_not_titles`
     - `person_seniorities`
     - `person_departments`
     - `person_locations`, `organization_locations`
     - `organization_industry_keywords`
     - `organization_num_employees_ranges`
     - `organization_estimated_annual_revenue_ranges`
     - `organization_technology_uids`
     - `q_keywords`, `q_organization_keyword_tags`
     - `contact_email_status` (verified/guessed/unavailable)
     - `organization_domains`, `organization_not_domains`
   - Adaptar `runProspectSearch` para montar a query Apollo a partir de `filters` (arrays reais) em vez de parsear strings.
   - Preencher as colunas legadas (`industry`, `role_title` etc.) com `array.join(", ")` para não quebrar a listagem existente.
3. Nova tela `src/components/prospecting/prospect-search-form.tsx` com o layout acima, consumida por `src/routes/_authenticated/settings.prospecting.tsx`. O modal atual é substituído por um `Sheet` largo ou por navegação para `/prospecting/searches/$id`.
4. Novo componente reutilizável `src/components/ui/multi-select-chips.tsx` (input com chips + colar CSV) e `src/components/ui/multi-select-options.tsx` (multi-seleção de opções fixas).
5. Constantes de opções em `src/lib/prospecting-options.ts` (senioridades, departamentos, ranges de headcount e receita, status de email) em PT-BR com o valor Apollo por baixo.

## Escopo e não-escopo

Escopo:

- Redesenhar apenas a UI de criação/edição de busca e a serialização dos filtros para Apollo.
- Migration aditiva de `filters jsonb` em `prospecting_searches`.
- Ajuste do `runProspectSearch` para consumir os novos filtros estruturados.

Fora do escopo:

- Não alterar a tela de resultados, importação para lead, cadências, scoring ou RLS.
- Não remover a geração heurística legada (já foi removida em turnos anteriores).
- Não integrar novas fontes além do Apollo.

## Validação manual

1. Abrir `/prospecting?tab=prospecting` e criar uma nova busca.
2. Confirmar que campos básicos aparecem com chips e placeholders.
3. Expandir "Mostrar todos os filtros" e preencher senioridade, departamento e range de funcionários.
4. Executar a busca e conferir no painel de resultados que vieram prospects com metadados Apollo reais coerentes com os filtros.
5. Reabrir a busca salva e conferir que todos os filtros voltam preenchidos.
