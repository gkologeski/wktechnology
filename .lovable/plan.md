# Enriquecimento em massa acima de 500 registros

## Problema
O servidor aceita no máximo 500 registros por chamada. O modal envia todos os selecionados de uma vez (5.927 leads), por isso aparece o erro técnico "too_big".

## O que muda
1. **Envio em lotes de 500**: o modal divide a seleção e processa um lote de cada vez, na ordem. O limite e as validações do servidor continuam iguais.
2. **Progresso visível**: aparece uma barra com "Lote X de Y · N de 5.927 processados". O botão fica desabilitado durante a execução.
3. **Interromper**: botão "Interromper" encerra depois do lote atual. O que já foi aplicado fica salvo e o resumo mostra o que foi feito até ali.
4. **Resumo somado**: o total de atualizados, sem mudanças, falhas, créditos e telefones pendentes considera todos os lotes. Na simulação, a prévia junta os lotes e mostra as primeiras 200 linhas, para a tela continuar leve.
5. **Falha em um lote**: o processo para e mostra uma mensagem em português ("Falha no lote 4 de 12: …"). Os lotes anteriores ficam mantidos.
6. **Aviso antes de aplicar**: para mais de 500 registros em execução real, o sistema pede confirmação com o número de lotes e o teto estimado de créditos (1 por registro).
7. **Ajuste visual**: Lusha aparece desmarcado quando não está conectado. Hoje ele aparece marcado, mesmo sem uso.

## Fora do escopo
- O servidor, as permissões e a lógica do Apollo não mudam.
- O enriquecimento não será executado. Nada será publicado.

## Detalhes técnicos
- Só `src/components/enrichment/bulk-enrich-dialog.tsx` muda. Uma função pura `chunkIds(ids, 500)` e o somatório dos resultados ficam em `src/lib/integrations/enrichment-batching.ts`, com teste vitest para lotes, sobra e soma.
- O laço sequencial usa `await enrich(...)` com um `ref` de cancelamento. O fechamento do modal fica bloqueado durante a execução, ou passa a pedir confirmação.
- A validação inclui o teste, typecheck, lint e build. O Playwright faz uma simulação com mais de 500 leads e confere a barra de progresso e a ausência do erro.
