# Concluir tarefas em massa sem erro

## Causa (confirmada no código)
"Concluir" em massa envia todas as tarefas selecionadas (1.810 no print) numa única requisição, com todos os IDs no endereço. O endereço fica grande demais e o navegador recusa a chamada: aparece "TypeError: Failed to fetch". Além disso, quando falta permissão, nada avisa: a tela mostra "concluída(s)" mesmo que nenhuma tarefa tenha sido alterada.

## Correção
1. Dividir a conclusão em lotes de 200 tarefas, enviados um depois do outro.
2. Mostrar o progresso ("Concluindo 400 de 1.810…") e desativar o botão enquanto o envio estiver em andamento.
3. Contar as tarefas que foram de fato alteradas (`.select("id")`). Se nenhuma mudar, mostrar o aviso de permissão (`deniedIfUnaffected`). Se só parte mudar, mostrar "X de Y concluída(s)".
4. Se um lote falhar, parar, informar quantas tarefas já foram concluídas e manter a seleção para tentar de novo.
5. Revisar a mesma divisão em lotes no "Excluir" em massa (`deleteRowsGuarded`) e aplicá-la se ele também enviar tudo de uma vez.

## Fora do escopo
Não muda permissões, dados nem o visual da tela.

## Validação
- Teste unitário do divisor de lotes.
- Rodar lint e build.
- Playwright: selecionar todas as tarefas e concluir apenas dentro de um filtro pequeno de teste, sem alterar tarefas reais em massa sem o seu aceite.

## Técnico
`src/routes/_authenticated/tasks.tsx` → `bulkComplete`, mais um helper `chunk` reutilizável.
