## Problema

Ao qualificar o lead na fila (`/prospecting/queues/$queueId/play`), o `CreateDealFromLeadDialog` abre corretamente, mas a tela não avança após a criação do negócio. Nas outras decisões (desqualificar / nutrição), também não há avanço automático.

## Regra de avanço

Avançar para o próximo lead **somente** quando houver ação efetiva sobre o lead atual:

- **Qualificar**: avança apenas se o negócio for realmente criado no `CreateDealFromLeadDialog` (`onCreated` disparado). Se o modal for fechado/cancelado sem criar negócio, permanece no mesmo lead.
- **Desqualificar**: avança após confirmação com motivo obrigatório.
- **Enviar para nutrição**: avança após confirmação.

## Mudança

Arquivo único: `src/routes/_authenticated/prospecting.queues.$queueId.play.tsx`.

- Passar `onDecided` para `<QualificationPanel>` executando `setIdx((i) => Math.min(i + 1, total))`.
- O `QualificationPanel` já dispara `onDecided("qualified")` apenas dentro de `onDealCreated`, que é chamado exclusivamente após criação bem-sucedida do negócio (fechar/cancelar o dialog não chama). Portanto o comportamento pedido já é garantido pelo callback do dialog — basta plugá-lo.

## Como validar

1. Abrir `/prospecting/queues/:id/play` com múltiplos leads.
2. Clicar em "Qualificar", **fechar** o modal sem criar negócio → deve permanecer no mesmo lead.
3. Clicar em "Qualificar" novamente e **concluir** a criação do negócio → deve avançar para o próximo lead.
4. "Desqualificar" (com motivo) e "Enviar para nutrição" → também avançam.

## Fora de escopo

- Nenhuma alteração em `QualificationPanel`, `CreateDealFromLeadDialog`, RLS, schema ou lógica de negócio.
