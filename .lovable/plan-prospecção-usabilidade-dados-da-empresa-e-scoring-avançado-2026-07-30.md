# Prospecção — usabilidade, dados da empresa e scoring avançado

Cinco frentes na suíte `/prospecting`, todas aditivas e sem remover funcionalidades existentes.

## 1. Fila — modal "Nova fila" guiado

Hoje o modal usa texto livre ("Status separados por vírgula", "Fontes", "Busca livre") sem indicar opções válidas.

- Status: multi-select com as opções reais da entidade (Lead: Novo, Em trabalho, Contatado, Qualificado, Desqualificado, Convertido, Perdido, Em nutrição; Contato: estágios de ciclo de vida), reaproveitando os mapas de rótulos já existentes na aba.
- Fontes: autocomplete com as fontes já cadastradas no workspace (catálogo `lead_sources`), permitindo adicionar uma nova por digitação.
- Busca livre: mantém o campo, mas com placeholder e texto de ajuda explicando que procura por nome, sobrenome, e-mail e empresa, sem diferenciar maiúsculas.
- Score mín./máx.: texto de ajuda indicando que filtra pelo score calculado pelas regras de Scoring.
- Cada campo ganha descrição curta; o modal passa a permitir também **editar** uma fila existente (hoje só cria), reaproveitando o mesmo formulário.

## 2. Cadências — editar passos existentes

Hoje um passo só pode ser criado ou excluído.

- Cada passo da régua ganha ação "Editar", abrindo o mesmo formulário já usado para adicionar, preenchido com canal, delay, assunto, mensagem e (para "Aguardar aceite") os campos de espera máxima, intervalo e ação no timeout.
- Salvar usa a função de upsert já existente passando o `id` do passo.
- Botões para mover passo para cima/baixo, reordenando `step_order`.
- O formulário exibe os campos específicos por canal (assunto só em e-mail, instruções em tarefa, dias em espera).

## 3. Lead sempre com empresa e dados firmográficos

- **Criação manual**: no modal "Criar lead", Empresa passa a ser obrigatória; o campo já permite buscar ou criar inline. O botão só habilita com empresa selecionada.
- **Importações (Apollo, HubSpot, CSV)**: antes de gravar o lead, o sistema procura a empresa pelo domínio e depois pelo nome; se não existir, cria a empresa com os dados disponíveis e vincula. Registros sem nenhum dado de empresa não são importados e aparecem no relatório de falhas com o motivo.
- **Captura Apollo**: além dos dados da pessoa, passamos a gravar os dados da organização (nome, domínio, site, setor, faixa e número de funcionários, faturamento estimado, cidade/estado/país, telefone, LinkedIn, descrição, tecnologias). Esses campos alimentam a empresa criada/atualizada e ficam guardados no resultado da busca.
- Empresa criada pela importação recebe origem registrada para auditoria; empresa já existente é enriquecida apenas nos campos vazios (não sobrescreve dados preenchidos por um usuário).

## 4. Scoring — regras com vários filtros e entidades

- Uma regra passa a aceitar um **grupo de condições** combinadas com E/OU (com subgrupos), em vez de uma única condição.
- Cada condição pode apontar para campos do Lead **ou** da Empresa vinculada ao lead (ex.: porte, faturamento, setor), usando o catálogo de campos já existente.
- A pontuação da regra é aplicada uma única vez quando o conjunto de condições é satisfeito.
- Interface: construtor de condições no mesmo padrão do Workflow (linhas com Entidade → Campo → Operador → Valor, botões "Adicionar condição" / "Adicionar grupo" e alternador E/OU).
- Compatibilidade: regras existentes com uma condição continuam funcionando (são lidas como grupo de um item).

## 5. Enrichment — histórico completo

A aba passa a ter duas seções:

1. **Enriquecimento**: a tabela atual de execuções (provedor, entidade, status, totais, créditos), mantendo o detalhamento por item.
2. **Buscas de prospects**: histórico das buscas Apollo (nome, filtros aplicados, status, quantidade de resultados, data, mensagem de erro/aviso), com ação para abrir a busca na aba "Busca de prospects".

## Detalhes técnicos

- UI: `queue-tab.tsx` (modal de fila + edição), `cadences-tab.tsx` (form de passo reutilizável + reorder), `settings.scoring.tsx` (construtor de condições), `settings.enrichment.tsx` (segunda seção usando `listProspectSearches`), `create-lead-dialog.tsx` (empresa obrigatória).
- Backend: `src/lib/prospecting.functions.ts` (captura firmográfica + resolução/criação de empresa na importação), `src/lib/scoring.functions.ts` (schema de condição recursivo em Zod), `src/lib/scoring/engine.server.ts` (avaliação de grupos AND/OR + carregamento da empresa vinculada ao avaliar campos `company.*`).
- Banco: novas colunas em `prospecting_results` para os dados da organização (faturamento, faixa de funcionários, site, LinkedIn, cidade/estado/país, tecnologias) e índice auxiliar em `companies(domain)` para o casamento por domínio. Sem alteração de RLS além dos GRANTs padrão das colunas novas. Nenhum `NOT NULL` em `leads.company_id` (evita quebrar leads históricos); a obrigatoriedade fica no formulário e na importação.
- Validação: Zod nas server functions e no formulário; typecheck e lint ao final.
