# Variáveis de associações do gatilho nos workflows

Dois problemas em `/settings/workflows`:

1. As pills de variáveis (ex.: no "Título do contrato") só listam colunas da própria entidade do gatilho. Campos de empresa, contato e outras associações não aparecem.
2. Campos de referência do passo ("Empresa contraparte", "Negócio", "Contato", "Responsável") só permitem escolher um registro fixo da lista ou digitar um token manualmente. Não há opção pré-carregada de "usar a empresa/negócio do gatilho" ou a saída de um passo anterior.

## 1. Variáveis de associações no catálogo de tokens

- Além do catálogo da entidade do gatilho, carregar o catálogo das entidades associadas declaradas em `src/lib/workflows/associations.ts` (empresa, contato principal, negócio, pipeline, projeto, contrato, responsável, conforme a entidade).
- Gerar pills em grupos próprios por associação, com rótulo em PT-BR: grupo "Empresa (do gatilho)" com `{{company.name}}`, `{{company.domain}}`, `{{company.city}}`…; grupo "Contato principal (do gatilho)" com `{{primary_contact.first_name}}`, `{{primary_contact.email}}`, `{{primary_contact.phone}}`…; e assim para as demais associações.
- Restringir a um conjunto útil de campos por entidade associada (nome/razão social, e-mail, telefone, documento, cidade/estado, etapa, valor, datas) para não gerar centenas de pills; nada de colunas técnicas/IDs internos.
- Manter os grupos já existentes: Registro, Identificadores (ID), Passos anteriores e Variáveis do fluxo.

## 2. Motor resolve as associações

- Antes de executar os passos, o motor hidrata o registro do gatilho com os registros associados presentes nas FKs (`company_id`, `primary_contact_id`, `deal_id`, `pipeline_id`, `assigned_to`/responsável, etc.), expondo cada um sob a chave lógica da associação (`company`, `primary_contact`, `deal`, …).
- A hidratação é feita uma vez por execução, apenas para as associações realmente referenciadas por tokens do fluxo (evita consultas desnecessárias), e sempre respeitando o workspace do registro.
- Associação vazia resolve para vazio, sem erro. Tokens já existentes continuam funcionando.

## 3. Campos de referência com opção "vinda do gatilho"

No seletor de campos de referência (`FkPicker`), acima da busca por nome, passa a existir uma seção pré-carregada:

- **Do gatilho**: opções compatíveis com o tipo do campo. Ex.: campo tipo empresa oferece "Empresa do gatilho" (`{{company_id}}`) e, quando o gatilho é a própria empresa, "Este registro" (`{{id}}`); campo tipo negócio oferece "Negócio do gatilho" (`{{deal_id}}`); tipo contato oferece "Contato principal do gatilho"; tipo usuário oferece "Responsável do gatilho" e "Criador do registro".
- **Passos anteriores**: registros criados por passos anteriores cujo tipo casa com o campo (ex.: passo "criar Empresa" aparece como opção em campo de empresa, gravando `{{steps.N.id}}`).
- Selecionar uma dessas opções grava o token correspondente e o campo mostra o rótulo amigável (ex.: "Empresa do gatilho") em vez do token cru.
- A busca por nome e o "Usar token…" continuam disponíveis; escolher um registro fixo segue funcionando igual.
- Só são oferecidas opções cujo tipo é compatível — nunca um token de texto em campo de referência.

## Detalhes técnicos

- `src/lib/workflows/token-catalog.ts`: novas funções para montar grupos de tokens de associação e a lista de tokens de ID compatíveis por `RefKind` (gatilho + passos anteriores).
- `src/lib/entity-fields.functions.ts`: server fn para retornar catálogos de várias entidades em uma chamada (entidade do gatilho + associadas), com a lista curada de campos por entidade.
- `src/components/workflows/workflow-builder.tsx`: buscar os catálogos associados e passar os novos grupos para `tokenSets`.
- `src/components/workflows/extra-fields-editor.tsx` (`FkPicker`): seção "Do gatilho" / "Passos anteriores" no popover, com rótulo amigável quando o valor é um token conhecido.
- `src/lib/workflows/engine.server.ts` (+ `associations.ts`): hidratação das associações no `after` antes das ações, com carregamento sob demanda.
- Sem alteração de schema, RLS, autenticação ou regra de negócio.

## Validação manual

1. Em um workflow com gatilho em Negócios, abrir um passo com campo de texto e confirmar as pills de "Empresa (do gatilho)" e "Contato principal (do gatilho)".
2. No passo "criar Contrato", em "Empresa contraparte", escolher "Empresa do gatilho" e confirmar o rótulo amigável salvo.
3. Publicar e disparar o fluxo; conferir que o contrato criado ficou com a empresa e o negócio do registro do gatilho.
4. Criar um passo que gera uma empresa e confirmar que ele aparece como opção em campos de empresa de passos posteriores.
