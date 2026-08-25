# Incluir prospects em filas de prospecção

Na lista de resultados de uma busca (`/prospecting?tab=prospecting` → painel lateral da busca), hoje cada prospect só tem "Importar como Lead". Vamos permitir mandar prospects direto para uma fila e agir em lote.

## O que muda

**Por prospect (cada card do painel)**

- Novo botão "Incluir na fila" ao lado de "Importar como Lead".
- Abre o modal existente de prospecção, onde o usuário escolhe uma fila manual já existente **ou** digita o nome de uma nova fila para criar na hora (o modal já suporta as duas opções, incluindo a aba de Cadência).
- Como as filas trabalham com leads, o prospect é importado como lead automaticamente antes de entrar na fila (se já tiver sido importado, reaproveita o lead existente — sem duplicar).

**No topo da lista de resultados**

- "Importar todos os leads": importa todos os prospects ainda não importados, com confirmação da quantidade e um resumo ao final (importados / já existentes / falhas).
- "Incluir todos em uma fila": importa os pendentes e abre o mesmo modal de fila já com todos os leads selecionados.
- Ambos ficam desabilitados quando não há resultados, e mostram estado de carregamento durante o processamento.

## Detalhes técnicos

- Arquivo principal: `src/routes/_authenticated/settings.prospecting.tsx` (componente `ProspectingPage`, bloco do `Sheet` de resultados).
- Reuso de `AddToProspectingDialog` (`src/components/prospecting/add-to-prospecting-dialog.tsx`) — ele já lista filas manuais, cria fila nova via `upsertQueue` e adiciona via `addToQueue`. Nenhuma alteração de contrato é necessária; será controlado por estado local `queueIds: string[]`.
- Importação reutiliza `importProspectAsLead`, que é idempotente (`already: true` quando já importado) e devolve o `id` do lead; o retorno alimenta os ids passados ao modal.
- Lote executado sequencialmente/em pequenos grupos para não estourar limites, com contagem de sucesso/erro e refresh de `openResults` ao final.
- UI segue o design system: `Button` com variantes existentes, ícones lucide (`UserPlus`, `ListPlus`), `toast` do sonner, estados de loading/disabled.
- Sem mudanças de schema, RLS ou regras de negócio.
