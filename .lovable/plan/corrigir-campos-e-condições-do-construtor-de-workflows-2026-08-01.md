# Corrigir campos e condições do construtor de workflows

Sete ajustes em `/settings/workflows`, todos concentrados na camada de campos/condições do construtor, mais uma extensão do motor para expor as saídas dos passos anteriores.

## 1. Referências mostram nomes, não hashes

Hoje o catálogo de campos monta as opções a partir dos valores brutos da tabela e só traduz `pipeline_id`, `company_id`, `parent_company_id`, `assigned_user_id` e `owner_id`. Por isso "Contato principal" aparece como `231a574b-…`.

- Campos de referência passam a usar o seletor com busca por nome (o mesmo já usado nos campos do passo), tanto nas condições do gatilho/ramificação quanto nos critérios de meta. O valor gravado continua sendo o ID.
- Cobertura: contato, empresa, pipeline, usuário responsável (`assigned_user_id`, `assignee_id`, `approver_user_id`, `hiring_manager_id`, `notify_user_id`), projeto, negócio e contrato.
- O seletor mantém a alternativa "Usar token…" para quem quiser `{{campo}}`.

## 2. Responsável com 2 nomes e 1 ID

A lista de responsáveis mostra o ID quando o usuário não tem perfil com nome preenchido. Passa a haver fallback em cadeia: nome do perfil → e-mail do membro do workspace → "Usuário sem nome (ID abreviado)". Nunca mais um UUID cru como rótulo.

## 3. Campos de ID redundantes saem da lista

- Ocultar do seletor de campos as colunas técnicas redundantes: `stage_id` (já existe "Etapa"), `external_id`, `form_id` técnico, colunas `hs_*` restantes e IDs de sincronização.
- Condições já salvas apontando para esses campos continuam funcionando: o campo salvo é preservado e exibido, apenas não é oferecido em novas condições.

## 4. Motivo da perda e Tipo de negócio: combo ou texto conforme o cadastro

Regra: o construtor espelha o cadastro de origem.

- Motivo da perda: existe cadastro próprio de motivos; quando houver motivos cadastrados no workspace, o campo é combo com esses motivos; sem cadastro, permanece texto livre.
- Tipo de negócio: combo quando o cadastro do negócio restringe a seleção; texto quando o cadastro aceita digitação livre.
- A mesma regra vale para os demais campos com cadastro auxiliar (origem, categoria), evitando combos "inventados" a partir de amostras de dados.

## 5. Condição pode usar valor de etapas anteriores

- O motor passa a registrar as saídas de cada passo na execução (ID e campos do registro criado, variáveis de formatação, resultado de aprovação/atribuição).
- No seletor de campo da condição, além das propriedades do registro, aparece um grupo "Passos anteriores" listando apenas passos que vêm antes do passo atual no fluxo (respeitando ramificações), com as saídas disponíveis de cada um.
- A avaliação da condição resolve esses valores em tempo de execução; passo ainda não executado é tratado como vazio.

## 6. Passo "criar Contrato": rótulos e obrigatórios corretos

- O rótulo "Cargo" vem de um dicionário global que traduz `title` como cargo. Passa a haver rótulo por entidade: em Contratos, `title` = "Título do contrato"; em Contatos permanece "Cargo".
- A marcação de obrigatório (\*) e a lista de pendências passam a considerar apenas os campos realmente exigidos pela entidade do passo, eliminando a pendência falsa em "Cargo".
- O campo de título volta a ser texto com suporte a token, sem sugestão de valores de outros contratos.

## Detalhes técnicos

- `src/lib/entity-fields.functions.ts`: dicionário de rótulos por entidade, resolução de rótulos para todas as FKs conhecidas, fallback de nome de usuário, lista de colunas ocultas, e decisão combo/texto baseada em cadastro auxiliar em vez de amostra de valores distintos.
- `src/components/workflows/workflow-builder.tsx` (`FilterRow`): usar `FkPicker` para campos de referência e adicionar o grupo "Passos anteriores" no seletor de campo.
- `src/components/workflows/extra-fields-editor.tsx`: ampliar o mapa `FK_KIND` e alinhar obrigatórios com o catálogo por entidade.
- `src/lib/workflows/engine.server.ts` e `src/lib/workflows/types.ts`: registrar saídas por passo no contexto de execução e resolver referências `passo anterior` na avaliação de filtros.
- Sem alteração de schema, RLS, autenticação ou regra de negócio dos módulos.

## Validação manual

1. Em `/settings/workflows`, criar condição com "Contato principal" e confirmar busca/exibição por nome.
2. Conferir que "Etapa (ID)" não aparece mais e que "Etapa" segue funcionando.
3. Abrir o combo de Responsável e confirmar ausência de UUID.
4. Conferir combo/texto em Motivo da perda e Tipo de negócio conforme o cadastro.
5. Criar passo de contrato e confirmar "Título do contrato" sem pendência falsa.
6. Criar fluxo com 2 passos e usar, no segundo, uma condição sobre a saída do primeiro.
