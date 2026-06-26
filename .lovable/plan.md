## Problema

Ao abrir uma tarefa em `/tasks/:id`, a tela aparece desconfigurada:

- Botões "—" vazios no topo direito (badges de status/prioridade renderizando hífen como conteúdo de Badge fora de contexto).
- O corpo da tarefa exibe HTML cru (`<br>`, `<div>`) porque é renderizado como texto.
- Painel "Sobre" desencaixado no canto inferior direito, sem coluna de timeline ou associações ao lado.
- Usa `<select>` nativo em vez do Select do design system.
- Não segue o padrão Quiet Premium aplicado em leads, deals e tickets (sem `RecordLayout`, sem `AssociationsPanel`, sem `ActivityTimeline`).

## Escopo

Apenas frontend de `src/routes/_authenticated/tasks.$id.tsx`. Não altero banco, RLS, server functions, regras de negócio ou outras telas.

## Mudanças

`src/routes/_authenticated/tasks.$id.tsx`:

1. Adotar o mesmo cabeçalho premium usado em leads/tickets: card arredondado com botão voltar circular, ícone/título da tarefa, badges de status/prioridade renderizadas apenas quando há valor (sem badge vazia "—"), data de vencimento e criação em metadados.
2. Renderizar `task.body` com HTML sanitizado via `DOMPurify` (mesma abordagem do `activity-timeline`), corrigindo a exibição de `<br>` e `<div>`.
3. Substituir o `<select>` nativo de Responsável por `Select` do shadcn, mantendo a função `reassign`.
4. Substituir o grid solto `[1fr_320px]` por `RecordLayout`:
   - Esquerda: `PropertiesPanel` com os mesmos campos atuais.
   - Centro: cabeçalho premium + card de descrição + `ActivityTimeline` filtrada para o contexto da tarefa (mostra comentários/edições; sem alterar regras).
   - Direita: `AssociationsPanel` referenciando a `activity` (entity `activities`) — apenas leitura/criação de vínculos, sem mudar lógica.
5. Manter ações "Concluir" e "Excluir" no header, com confirmação via `AlertDialog` (padrão das outras telas) em vez de `confirm()` nativo.
6. Sem mudanças em `useWorkspaceMembers`, queries Supabase atuais ou rotas.

## Validação manual

- Abrir uma tarefa existente a partir de `/tasks` e a partir da timeline de um lead/deal.
- Conferir que o corpo HTML é renderizado formatado.
- Conferir badges aparecem só quando há status/prioridade.
- Trocar responsável pelo novo Select e ver toast.
- Concluir e excluir tarefa via novos botões/alert dialog.
- Testar light/dark mode e responsividade (desktop, tablet, mobile).

## Fora de escopo

- Migrar conteúdo legado com HTML salvo no `body` para texto puro.
- Alterar a tela de listagem `/tasks` ou o editor inline da timeline.
- Mudar permissões, RLS ou schema.