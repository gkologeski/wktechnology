# Deixar claro que salvar = rascunho e facilitar publicar

Hoje o botão "Salvar" do editor de workflow grava apenas o rascunho (`draft_trigger` / `draft_actions`) e mostra o toast "Rascunho salvo". O workflow só passa a rodar depois de "Publicar", que existe apenas na listagem e só aparece quando há alterações pendentes. Isso não fica evidente para o usuário.

Decisão confirmada: manter o fluxo rascunho → publicar, mas deixar o estado explícito na interface e a publicação a 1 clique.

## O que muda

1. **Botão "Publicar" dentro do editor de workflow**
   - Ao lado do "Salvar" no cabeçalho do editor: `Salvar` (secundário) e `Salvar e publicar` (primário).
   - "Salvar e publicar" grava o rascunho e, em seguida, publica; ao final fecha o editor e mostra "Publicado — vN".
   - Ambos ficam desabilitados nas mesmas condições atuais (sem nome ou sem ações) e mostram estado de carregamento.

2. **Aviso de estado no editor**
   - Faixa discreta no topo do corpo do editor indicando: "Rascunho — as alterações não afetam registros até você publicar" quando o workflow não está publicado ou tem alterações pendentes; e "Publicado v N" quando está em dia.
   - Usa tokens semânticos e componentes existentes (Alert/Badge), sem cores avulsas.

3. **Feedback de salvamento mais claro**
   - Toast atual "Rascunho salvo" passa a "Rascunho salvo — publique para ativar", com ação "Publicar" no próprio toast (sonner action) chamando o publish já existente.

4. **Listagem: destaque do pendente**
   - Card com rascunho pendente ganha o botão "Publicar" em destaque (já existe) e uma linha de texto curta explicando que a versão publicada é a que está rodando.
   - Workflow ainda nunca publicado (`published_version = 0`) também mostra o botão "Publicar", que hoje só aparece quando `has_draft_changes` é verdadeiro.

## Detalhes técnicos

- `src/components/workflows/workflow-builder.tsx`: adicionar prop opcional `onSaveAndPublish?: (d: WorkflowDraft) => Promise<void>` e a prop de status (`status`, `publishedVersion`, `hasDraftChanges`) para a faixa informativa; novo botão no header.
- `src/routes/_authenticated/settings.workflows.tsx`: implementar `handleSaveAndPublish` (chama `saveWorkflow` e depois `publishWorkflow` com o id retornado), passar status ao builder, ajustar toast do `handleSave` e a condição de exibição do botão "Publicar" na listagem para `has_draft_changes || published_version === 0`.
- `saveWorkflow` precisa retornar o `id` do workflow criado para permitir publicar em seguida (verificar retorno atual em `src/lib/workflows.functions.ts` e ajustar se necessário, mantendo o comportamento existente).
- Sem mudanças de schema, RLS, engine de execução ou semântica de publicação.

## Como validar

1. Criar novo workflow, clicar "Salvar": permanece rascunho, toast com ação "Publicar", faixa indica rascunho.
2. Clicar "Salvar e publicar": listagem mostra "Publicado v1" e o workflow passa a executar.
3. Editar um workflow publicado e salvar: aparece "Rascunho pendente (publicado vN)" e o botão Publicar em destaque; "Descartar" continua funcionando.
