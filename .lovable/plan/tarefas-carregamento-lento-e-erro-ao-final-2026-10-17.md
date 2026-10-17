# Tarefas: carregamento lento e erro ao final

## Diagnóstico (confirmado)
- Os registros da tela mostram a lista de Tarefas voltando com erro **"canceling statement due to statement timeout"**. O banco desiste da busca por demorar demais. Isso aparece duas vezes, porque o sistema tenta de novo e falha outra vez. Daí a espera longa seguida do erro.
- A busca da aba "Minhas abertas" é: tarefas em que eu sou o responsável, **ou** tarefas sem responsável em que eu sou o criador. Ela vem ordenada pela data de criação e também pede a **contagem exata** de todos os resultados.
- Volume: 426 mil atividades no total, das quais 53 mil são tarefas.
- Índices existentes: há índices só de tarefas por workspace + data, status, prioridade e vencimento. **Não há** índice de tarefas por responsável (`assigned_to`) + data, nem por criador + data restrito a tarefas. Com isso, o "OU" entre responsável e criador, somado à contagem exata e às regras de visibilidade, obriga o banco a varrer muitas tarefas.
- Ainda não confirmado: quanto do tempo vem das regras de visibilidade. O passo 1 mede isso.

## Correções propostas
1. **Medir antes de mexer**: rodar o plano de execução real da busca da aba "Minhas abertas", como o usuário, para confirmar onde o tempo é gasto.
2. **Índices só de tarefas** (aditivos, sem alterar dados nem permissões):
   - responsável + criação: `(workspace_id, assigned_to, created_at desc)`, apenas tarefas não excluídas;
   - criador + criação para tarefas sem responsável: `(workspace_id, owner_id, created_at desc)`, apenas onde `assigned_to is null`;
   - um índice parcial para tarefas abertas (`completed = false`) por responsável e vencimento.
3. **Contagem mais leve**: trocar a contagem exata por uma estimada no total da lista. A exata fica só quando o resultado é pequeno ou quando é preciso selecionar todos. Assim a lista aparece mesmo que a contagem demore.
4. **Erro amigável e sem repetir a mesma busca lenta**: no estouro de tempo, mostrar a mensagem "A lista demorou para responder" com o botão "Tentar novamente", em vez de tentar outra vez automaticamente. A estrutura da tela continua visível.
5. **Busca por texto**: só começa a partir de 2 caracteres. É o caso mais pesado (assunto/corpo com "contém").
6. Revalidar com o Playwright as abas Minhas abertas, Vencem hoje, Atrasadas, Concluídas e Todas, medindo o tempo antes e depois. Rodar também testes, lint e build.

## Fora do escopo
Sem mudança em regras de visibilidade, permissões, dados ou visual da tela.

## Detalhes técnicos
- Arquivo: `src/routes/_authenticated/tasks.tsx` (`applyTaskFilters`, query com `count: "exact"` e `range`).
- Migration com `CREATE INDEX IF NOT EXISTS` (não concorrente, dentro da migration).
- `count: "planned"` com fallback para `"exact"` quando a estimativa for menor que cerca de 1.000. `retry` desligado para o código 57014.
- Usar `EXPLAIN (ANALYZE, BUFFERS)` com `set role authenticated` + claims do usuário para confirmar o uso dos índices.
