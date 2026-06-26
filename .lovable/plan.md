## Objetivo
Garantir que as telas de detalhe de entidade (Lead, Deal, Company, Contact, Ticket) usem layout firme em 3 colunas — esquerda: informações, centro: timeline de atividades, direita: associações — sem que a coluna de associações caia para baixo da timeline em larguras intermediárias.

## Diagnóstico
`src/components/record/record-layout.tsx` hoje define:
- `grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-12`
- A direita usa `order-2 lg:order-3 lg:col-span-2` dentro de um grid de 2 colunas → não cabe e quebra abaixo do centro.
- Só em `2xl` (≥1536px) o layout vira 3 colunas reais (3/6/3).
- Resultado no viewport atual (~1052px): associações empilham abaixo da timeline.

Também é o componente já usado por todas as telas listadas, então basta corrigi-lo num único lugar.

## Mudanças

### 1. `src/components/record/record-layout.tsx`
- Substituir o grid por 3 colunas reais a partir de `lg`:
  - `grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_300px] 2xl:grid-cols-[280px_minmax(0,1fr)_320px]`
- Remover o esquema `2xl:grid-cols-12` e os `col-span` correspondentes.
- Ajustar ordens para empilhar de forma legível no mobile:
  - mobile: esquerda → direita (associações) → centro? Não. Mobile mantém ordem natural: esquerda, centro, direita (1, 2, 3) para preservar leitura quando empilhado.
- Garantir `min-w-0` em todas as colunas (já presente).
- Manter `header` full-width acima.

### 2. Sem mudanças nas páginas
As 5 telas (`leads.$id`, `deals.$id`, `companies.$id`, `contacts.$id`, `tickets.$id`) já passam `left`, `center`, `right` ao `RecordLayout`. Nenhuma alteração necessária nelas.

### 3. Verificações
- Visualmente em ~1052px (viewport atual), ~1280px, ~1440px e ≥1536px: 3 colunas lado a lado.
- Em <1024px: colunas empilham (esquerda, centro, direita) com `min-w-0` evitando overflow.
- Nada muda em regras de negócio, queries, RLS, server functions ou conteúdo dos painéis.

## Fora de escopo
- Reordenar ou redesenhar os painéis internos (PropertiesPanel, ActivityTimeline, AssociationsPanel).
- Mover blocos extras (Itens de linha / Cotações em `deals.$id`, Hierarquia em `companies.$id`) — eles continuam onde estão, dentro da coluna direita abaixo das associações, conforme já implementado.
- Alterar telas que não usam `RecordLayout`.

## Como validar manualmente
1. Abrir `/leads/:id`, `/deals/:id`, `/companies/:id`, `/contacts/:id`, `/tickets/:id`.
2. Em desktop (≥1024px): confirmar 3 colunas lado a lado, associações à direita da timeline.
3. Redimensionar abaixo de 1024px: confirmar empilhamento sem corte de conteúdo.
4. Alternar dark mode: sem regressão visual.
