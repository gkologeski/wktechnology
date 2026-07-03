## Objetivo
Eliminar a aba duplicada "Candidatos" em detalhes da vaga (`/jobs/:id`), mantendo a aba "Pipeline".

## Alterações
Arquivo: `src/routes/_authenticated/(ats)/jobs.$id.tsx`

1. Remover `<TabsTrigger value="candidates">Candidatos</TabsTrigger>` (linha 763).
2. Remover o bloco `<TabsContent value="candidates">…</TabsContent>` (linhas 784-786).
3. Ajustar a mensagem na linha 588 ("aba Candidatos" → "aba Pipeline") para refletir a nova estrutura.

## Fora de escopo
Nenhuma mudança em lógica de dados, RLS ou outras abas.