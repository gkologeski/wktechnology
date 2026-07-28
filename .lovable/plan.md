## Problema

Ao qualificar/desqualificar/nutrir um lead na fila (`/prospecting/queues/$queueId/play`), a fila avança para o próximo item (`idx++`), mas o `QualificationPanel` mantém as respostas do lead anterior.

## Causa

`QualificationPanel` mantém estado local (`answers`, `reason`, `reasonValue`, `reasonNote`, `selectedId`) inicializado apenas no primeiro render. Ao trocar apenas a prop `entityId`, o componente não é remontado e o `useState` não reinicializa, então os campos preenchidos persistem entre leads.

Além disso, mesmo se remontasse, o `useState(existingForActive?.answers ?? {})` roda antes da query `listQualificationsForEntity` terminar, então respostas já salvas do novo lead não apareceriam.

## Correção

Escopo: apenas o player de fila e o painel de qualificação. Sem mudanças de dados/RLS.

1. **`src/routes/_authenticated/prospecting.queues.$queueId.play.tsx`**  
   Forçar remontagem do `QualificationPanel` por lead adicionando `key={id}`. Solução mínima e localizada — não afeta uso do painel em `/leads/$id`.

2. **`src/components/prospecting/qualification-panel.tsx`**  
   Sincronizar `answers` com `existingForActive` via `useEffect` para que, quando o histórico do novo lead carregar, o formulário reflita respostas existentes (ou fique vazio se não houver). Resetar também `reason`. Chave de dependência: `existingForActive?.id` + `activeId`.

Isso garante: (a) ao avançar, o formulário zera imediatamente pelo remount; (b) se o novo lead já tiver qualificação salva, ela aparece após a query resolver.

## Como validar

- Abrir uma fila com ≥ 2 leads.
- Preencher respostas no lead A e clicar em **Qualificar** (criar negócio) / **Nutrição** / **Desqualificar**.
- Verificar que o lead B abre com formulário zerado (ou com respostas prévias se já qualificado antes).
- Repetir com **Pular (S)** e **Próximo (N)**.
