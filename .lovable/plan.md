# Filtros de público do WhatsApp com todos os campos

## Problema
Hoje os filtros oferecem só uma lista fixa curta: Leads 6 campos, Contatos 7, Empresas 5 e Negócios 5. Campos como e-mail, telefone, site, porte, funcionários, receita, valor do negócio, pipeline, datas de fechamento e campos personalizados ficam de fora.

## O que muda
- O seletor de campo de cada filtro passa a listar todos os campos de Lead, Contato, Empresa e Negócio, os mesmos que aparecem no editor de colunas das listas e nos Workflows. Os campos personalizados do workspace também entram.
- Os campos aparecem agrupados por entidade, com busca por nome, porque a lista fica longa.
- Cada tipo de campo tem seus operadores:
  - texto: contém, é igual a, não contém, está vazio, não está vazio;
  - número/valor: igual, maior ou igual, menor ou igual, vazio;
  - data: depois de, antes de, vazio;
  - sim/não: é sim, é não;
  - lista: é, não é;
  - responsável e referências (empresa, pipeline, etapa): escolha por nome.
- Campos de lista mostram as opções do catálogo, e campos de texto mostram os valores já existentes no workspace, como já acontece hoje em "Setor".
- Filtros e segmentos já salvos continuam funcionando.

## Regras preservadas
- O servidor só aceita campos que existem no catálogo da entidade e operadores compatíveis com o tipo do campo. Campos sensíveis ou internos ficam fora: tokens, `*_digits`, campos de sistema ocultos, `workspace_id` e `owner_id`.
- Vale só o workspace ativo e o que o usuário pode ver. Limite de 5.000 destinatários, regras de celular do Brasil e controle de reenvio continuam iguais.
- Não há migration nem envio.

## Validação
- Testes: campo do catálogo aceito, campo fora do catálogo recusado, operador incompatível recusado, campo personalizado, filtro antigo ainda válido.
- Verificação de tipos, estilo, testes e build, com os resultados reais.
- No navegador, em /campaigns/whatsapp: filtrar por Empresa › Porte, Negócio › Valor ≥ X e Contato › E-mail não vazio, conferir a contagem e não salvar.

## Detalhes técnicos
- `campaign-audience.ts`: a `FILTER_FIELDS` fixa vira o padrão base (mantém os rótulos e enums atuais). A lista completa vem de `getEntityFieldCatalog` (leads/contacts/companies/deals), mapeando o tipo para `kind` (text/number/date/boolean/enum/member/ref).
- Servidor (`campaign-audience.server.ts` / `previewCampaignAudience`): valida cada filtro contra o catálogo carregado no handler, com uma lista de colunas bloqueadas. Campos personalizados (JSON) são filtrados via `custom_fields->>key`. `listAudienceFieldValues` passa a usar a mesma validação.
- UI (`audience-groups-editor.tsx`): o seletor de campo vira um Combobox (Command) agrupado com busca, e o editor de valor é escolhido pelo `kind`: Select, `AudienceValueCombobox`, input numérico, data ou seletor de membro/referência.
