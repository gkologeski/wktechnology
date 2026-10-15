# Público das campanhas WhatsApp: grupos E/OU com filtros de várias entidades (estilo HubSpot)

## O que muda na tela (aba "Criar público")
- A **Base** continua definindo quem recebe (Leads, Contatos, Empresas ou Negócios).
- Os filtros passam a ficar dentro de **grupos**, como nos segmentos do HubSpot:
  - Dentro de um grupo, os filtros se somam com **E** (todos precisam valer).
  - Entre grupos, a ligação é **OU** (basta um grupo valer). Um separador "OU" aparece entre os cartões dos grupos.
  - Cada grupo também tem um seletor para trocar sua combinação interna para **OU**, se o usuário preferir.
  - Botões: "Adicionar filtro" (dentro do grupo), "Adicionar grupo OU", duplicar e remover grupo.
- Cada filtro escolhe primeiro a **entidade** e depois o **campo**, agrupados no seletor: Lead, Contato, Empresa, Negócio (ex.: base Contatos + filtro "Empresa › Setor contém soft" E "Negócio › Etapa é Proposta").
- Operadores por tipo de campo: texto (contém, é igual a, não contém, está vazio, não está vazio), lista (é, não é, é qualquer um de), data (depois de, antes de), responsável (é, é qualquer um de, está vazio).
- Contagem ao vivo e o resumo de excluídos continuam como hoje; grupo vazio é ignorado.
- "Carregar segmento salvo" e "Salvar como segmento" continuam funcionando com o novo formato.
- Estados de carregamento/erro, rótulos acessíveis, foco visível e modo escuro preservados.

## Como uma entidade relacionada filtra a base
- Contato → Empresa (empresa do contato), Negócio (negócios ligados ao contato), Lead (lead convertido no contato).
- Empresa → Contatos da empresa, Negócios da empresa.
- Negócio → Empresa, Contato principal/contatos do negócio.
- Lead → Empresa, Contato e Negócio convertidos.
- Filtro em entidade relacionada significa "existe algum registro relacionado que atende". Os mesmos vínculos já usados para as variáveis.

## Regras preservadas
- Campos e operadores continuam em lista branca, validados no servidor; somente o workspace ativo e o que o usuário pode ver (RLS).
- Limite de 5.000 destinatários, regras de telefone/duplicado/descadastro, ritmo e disparo inalterados.
- Campanhas e segmentos salvos no formato antigo (lista simples de filtros) continuam válidos: são lidos como um grupo único com E.
- Sem migration.

## Validação
- Testes: E dentro do grupo, OU entre grupos, grupo vazio ignorado, filtro de entidade relacionada, campo/operador fora da lista recusado, compatibilidade com formato antigo.
- Typecheck, lint, testes e build com resultados reais.
- Playwright em /campaigns/whatsapp: montar 2 grupos (Empresa › Setor contém "soft" OU Contato › Estado = SC), conferir a contagem, salvar rascunho e excluí-lo. Nada enviado nem publicado.

## Detalhes técnicos
- `campaign-audience.ts`: `AudienceFilter` ganha `entity` (padrão = base) e novos ops (`neq`, `not_ilike`, `in`, `is_null`, `is_not_null`); novo `AudienceFilterTree = { groups: { logic: "and"|"or"; filters: AudienceFilter[] }[] }` (OU entre grupos); `normalizeAudienceFilters` converte o array antigo; `isAllowedFilter` passa a validar por `FILTER_FIELDS[entity]`; limites de 10 grupos × 20 filtros.
- `campaign-audience.server.ts`: para cada grupo, resolve conjuntos de IDs da base (filtro da própria base aplicado direto; filtro relacionado consulta a tabela relacionada e mapeia pela chave estrangeira/`deal_contacts`), intersecção (E) ou união (OU) dentro do grupo, união entre grupos; depois busca as linhas por IDs em lotes de 1.000 com o cliente do usuário.
- `previewCampaignAudience`/`createWhatsAppCampaign`: aceitam o novo formato via zod com `z.union` para o antigo.
- UI em `campaigns.whatsapp.tsx`: extrair `AudienceGroupsEditor` (componente presentacional, sem chamadas ao banco) com `Select` agrupado por entidade.
