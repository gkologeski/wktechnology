## Objetivo
Transformar os questionários base (BANT/MEDDIC/CHAMP/GPCT) em **modelos read-only** e adicionar ação de **Duplicar** para que o usuário trabalhe sobre uma cópia editável.

## Comportamento

- Modelos aparecem em uma seção separada "Modelos" com badge "Modelo".
- Nos modelos, o usuário só pode **Visualizar** e **Duplicar** — sem editar, sem excluir, sem adicionar/remover perguntas, sem toggle "Ativo".
- Duplicar cria um novo questionário editável do usuário (com sufixo "(cópia)") + clona todas as perguntas.
- Os questionários "do usuário" mantêm o comportamento atual (editar, excluir, ativar/desativar).
- O botão "Criar a partir de..." atual passa a ter função equivalente a "Duplicar modelo" (mantém a experiência de partir de um framework pronto).

## Mudanças

**1. Banco (migration)**
- Adicionar coluna `is_template boolean NOT NULL DEFAULT false` em `prospecting_questionnaires`.
- Marcar os questionários seed atuais (BANT/MEDDIC/CHAMP/GPCT já criados no workspace) como `is_template = true`.
- Ajustar RLS: bloquear `UPDATE`/`DELETE` quando `is_template = true` (policies com `WITH CHECK NOT is_template` e `USING NOT is_template` para write/delete; SELECT continua liberado). Análogo para `prospecting_questions` via join no questionário.

**2. Server functions (`src/lib/prospecting/questionnaires.functions.ts`)**
- `listQuestionnaires`: incluir `is_template` no select.
- `upsertQuestionnaire` (update) e `deleteQuestionnaire`: rejeitar se `is_template = true`.
- `upsertQuestion` / `deleteQuestion`: validar via join que o questionário não é modelo.
- Nova `duplicateQuestionnaire({ id })`: clona o questionário (força `is_template=false`, `framework='custom'` ou mantém framework mas sem flag) + copia todas as perguntas preservando ordem/pesos/opções.
- `seedFramework`: manter, mas agora atua como "duplicar do modelo padrão" (nunca marca como template).

**3. UI (`src/components/prospecting/questionnaires-tab.tsx`)**
- Separar em duas seções: **Modelos** (grid dos `is_template=true`) e **Meus questionários** (grid dos demais).
- Card do modelo: sem ícones de editar/excluir; apenas botão "Duplicar" (chama `duplicateQuestionnaire`) e "Visualizar" (abre um Sheet somente-leitura reutilizando o editor com `readOnly=true`).
- `QuestionnaireEditorSheet` recebe prop `readOnly` para desabilitar inputs, toggles, botões de adicionar/remover e o `QuestionRow`.
- Card dos "Meus questionários": adicionar botão "Duplicar" ao lado de Editar/Excluir.

**4. Seed inicial**
- Migration marca como modelo os questionários existentes cujo `framework != 'custom'` e cujo nome bate com os templates padrão, para não afetar customizações do usuário que possam ter framework preenchido.

## Fora do escopo
- Modelos globais compartilhados entre workspaces (permanecem por workspace).
- Alterações no `QualificationPanel` (usa `listQuestionnaires` filtrando por `enabled`, continuará funcional; modelos ficam com `enabled=false` por padrão para não poluir a fila).