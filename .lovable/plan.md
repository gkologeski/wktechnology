## Problema

`ActivityTimeline` carrega eventos com um `useEffect` cuja dependência é só `[relatedId, datePreset, dateCustom]`. Quando o `AssociationsPanel` adiciona/remove um contato ou empresa (ex.: `deal_contacts`, `deals.company_id`, `deals.primary_contact_id`), nenhum sinal é emitido para o timeline, então as atividades espelhadas só aparecem após F5 (quando o componente remonta e o `load()` roda de novo).

## Solução

Notificar o timeline sempre que uma associação muda, e reagir a esse sinal.

### 1. Emitir evento no `AssociationsPanel`

Em `src/components/record/associations-panel.tsx`, após cada mutação de associação bem-sucedida (vincular/desvincular contato em deal, definir empresa/contato primário, etc.), disparar:

```ts
window.dispatchEvent(new CustomEvent("timeline:refresh", {
  detail: { entityType, entityId },
}));
```

Aplicar nos pontos onde hoje há inserts/updates em `deal_contacts`, mudanças de `company_id`/`primary_contact_id` em deals, e equivalentes para contact↔company. Disparar para os dois lados do vínculo (ex.: ao vincular contato X ao deal Y, emitir para `{deal, Y}` e `{contact, X}`) para que qualquer timeline aberto em outra aba/janela do mesmo workspace receba.

### 2. Reagir no `ActivityTimeline`

Em `src/components/activity-timeline.tsx`, adicionar um `useEffect` que registra listener de `timeline:refresh` e chama `load()` quando o evento corresponde ao `relatedKey`/`relatedId` atual (ou quando o `detail` é o par espelhado — ex.: timeline do contato deve recarregar quando o evento é do deal que o referencia, e vice-versa).

Como o `load()` já é definido no escopo do componente, basta envolvê-lo num `useCallback` (ou usar uma ref) para evitar stale closure, e fazer `window.addEventListener("timeline:refresh", handler)` com cleanup.

### 3. Verificação

- Abrir um deal, associar um contato pela aba "Associações" → atividades do contato devem aparecer no timeline do deal sem reload.
- Abrir o contato em outra aba → também atualizar (mesmo evento de window).
- Remover a associação → entradas espelhadas somem sem reload.

## Fora de escopo

- Não mexer em RLS, no RPC `get_entity_timeline`, nem na lógica de mirror (`timeline_pins`); o backend já está correto, é só refresh no cliente.
- Não introduzir realtime/postgres_changes — overkill para esta correção; o `CustomEvent` cobre o fluxo originado na mesma sessão (que é o relato).
