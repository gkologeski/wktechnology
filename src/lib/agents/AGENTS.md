# Agentes de IA

- Blocos de fluxo de agentes vêm só de `src/lib/agents/flow/catalog.ts` (campos, saídas, validação) e executam por `runtime.ts` com `Tools` injetadas (sandbox sem efeitos, produção real); por quê: editor, canvas, teste e servidor usam um único contrato.
