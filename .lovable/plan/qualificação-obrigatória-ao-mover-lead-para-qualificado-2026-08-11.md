# Qualificação obrigatória ao mover lead para Qualificado

Quando qualquer usuário mover um lead para a etapa Qualificado, a tela de qualificação abre e precisa ser concluída. A regra que abria o modal de criação de negócio na qualificação é removida.

## O que muda

### 1. Gatilho pela etapa (detalhe do Lead)

- Ao clicar em uma etapa cujo tipo é "ganho" (ou valor `qualified`) na trilha de etapas, o lead **não** é gravado imediatamente: abre um modal de qualificação com o questionário ativo.
- A etapa só é gravada (`stage_id`, `pipeline_id`, `status` derivado) depois que a qualificação é concluída com decisão "qualificar".
- Fechar/cancelar o modal mantém o lead na etapa anterior (reversão), com aviso de que a qualificação é obrigatória.
- Decidir "Desqualificar" ou "Enviar para nutrição" dentro do modal aplica a etapa correspondente, como já ocorre hoje na prospecção.

### 2. Fim da criação automática de negócio

- O botão "Qualificar" passa a apenas registrar a qualificação (respostas + score + observações) e concluir a etapa.
- O modal de criação de negócio deixa de abrir automaticamente na qualificação. Criar negócio continua disponível manualmente pelo botão "Criar negócio" no detalhe do lead.

### 3. Campos de entidades configuráveis antes/depois das perguntas

- Botão "Configurar campos" acima do questionário (visível para quem pode editar questionários).
- No configurador o usuário escolhe blocos: entidade (Lead, Empresa, Contato), posição (antes ou depois das perguntas), título do bloco e quais campos aparecem.
- Os campos são **editáveis** e salvam no registro da respectiva entidade ao concluir a qualificação (ou ao salvar rascunho).
- A configuração é salva **por questionário**.

### 4. Obrigatoriedade

- Botão "Qualificar" continua bloqueado enquanto houver pergunta obrigatória sem resposta (comportamento atual) e passa a considerar também campos de entidade marcados como obrigatórios no configurador.

## Detalhes técnicos

- Migração: nova coluna `field_layout jsonb not null default '[]'` em `prospecting_questionnaires`, guardando os blocos `{ id, entity, position, title, fields: [{ key, label, required }] }`.
- `src/lib/prospecting/questionnaires.functions.ts`: incluir `field_layout` no get/save e nova função para atualizar apenas o layout (com a checagem de permissão já usada em questionários).
- Novo `src/components/prospecting/qualification-field-layout-dialog.tsx`: configurador dos blocos, alimentado pelo catálogo de campos existente (`src/lib/entity-fields.functions.ts`).
- Novo `src/components/prospecting/qualification-entity-fields.tsx`: renderiza e edita os campos do lead/empresa/contato de um bloco, com estados de carregando/vazio/erro.
- `src/components/prospecting/qualification-panel.tsx`: remove `CreateDealFromLeadDialog` e `openQualifyDialog`; nova ação `confirmQualify` que grava campos de entidade, salva a qualificação com `decision: "qualified"`, atualiza o lead para a etapa de ganho e chama `onDecided`. Renderiza os blocos antes/depois das perguntas e o botão de configuração.
- Novo `src/components/leads/lead-qualification-dialog.tsx`: modal que envolve o `QualificationPanel` para uso no detalhe do lead.
- `src/routes/_authenticated/leads.$id.tsx`: `setStage` intercepta etapas de tipo ganho, abre o modal e só persiste após a decisão; remove o gatilho automático de criação de negócio.
- Sem alteração em RLS, autenticação ou regras de negócio além do descrito. UI segue os componentes e tokens já usados na prospecção (light/dark, foco visível, estados de carregamento).

## Como validar

1. Em Configurações → Prospecção → Questionários, garantir um questionário ativo.
2. No detalhe de um lead, clicar na etapa "Qualificado": o modal de qualificação abre.
3. Fechar sem concluir → lead permanece na etapa anterior.
4. Usar "Configurar campos", adicionar um bloco com campos da Empresa depois das perguntas, salvar e reabrir: os campos aparecem e são editáveis.
5. Responder as obrigatórias e clicar "Qualificar": nenhum modal de negócio abre, o lead vai para Qualificado e a qualificação fica registrada.
