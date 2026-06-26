Ocultar os botões "Editar" e "Excluir" do item da timeline enquanto ele estiver em modo de edição (`editingId === a.id`), mantendo visíveis apenas "Salvar" e "Cancelar". Quando o usuário sair do modo de edição, os botões voltam a aparecer normalmente.

Arquivo afetado:
- `src/components/activity-timeline.tsx` — envolver o bloco dos botões "Editar"/"Excluir" (e demais ações de linha como concluir tarefa, se houver no mesmo agrupamento) em condicional `editingId !== a.id`.

Sem alterações de regra de negócio, schema, RLS ou estilos globais.