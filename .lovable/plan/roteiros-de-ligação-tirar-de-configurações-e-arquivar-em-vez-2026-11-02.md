# Roteiros de ligação: tirar de Configurações e arquivar em vez de excluir

Porte: P/M — estimativa ~35–45 min (1 mudança no banco + 3–4 arquivos + testes).

## Causas (confirmadas)
1. **Atalho em Configurações:** o item "Scripts de prospecção" em Configurações → Engajamento só redireciona para Prospecção → Campanhas → Roteiros. Roteiro é conteúdo operacional da campanha, não configuração.
2. **Sofia não exclui:** ela foi usada em 4 campanhas concluídas ("campanha inicial", "campanha 001", "Campanha Solver", "Solver 002"). O banco protege esse histórico e recusa a exclusão, mas a tela não mostra o erro — parece que nada aconteceu.

## O que muda
- **Configurações:** remover o item "Scripts de prospecção" de Engajamento. O endereço antigo continua levando para Prospecção → Campanhas → Roteiros (links salvos não quebram). Agente de voz continua em Configurações (é configuração de fato).
- **Arquivar roteiros:**
  - Roteiro nunca usado: botão "Excluir" continua apagando de verdade, com confirmação.
  - Roteiro já usado em campanha: o botão vira "Arquivar", com confirmação explicando que o histórico das campanhas é preservado.
  - Arquivados somem da lista e dos seletores de roteiro das campanhas; um filtro "Mostrar arquivados" permite ver e "Restaurar".
  - Qualquer erro passa a aparecer em mensagem clara em português.
- Permissões: arquivar/restaurar usam a mesma permissão de alterar roteiro; excluir continua exigindo a permissão de excluir.

## Técnico
- Migration: `prospecting_scripts.archived_at timestamptz null` (aditiva, sem mexer em RLS/policies existentes).
- `src/lib/prospecting-scripts.functions.ts`: `listScripts` filtra `archived_at is null` (opção `includeArchived`); nova `setScriptArchived` com `requireSalesPermission(..., "update")` + `assertSalesRecord`; `deleteScript` checa uso em `prospecting_campaign_variants` e devolve erro amigável.
- `scripts-page.tsx`: botões Excluir/Arquivar/Restaurar, filtro, try/catch com toast.
- Seletores de roteiro da campanha (inclusive o do bloco "WhatsApp após a ligação") passam a ignorar arquivados, mas mantêm o já selecionado de campanhas antigas.
- `settings.tsx`: remover item; `settings.prospecting-scripts.tsx` mantém redirect corrigido para `area=campanhas&section=roteiros`.
- Atualizar contratos em `permission-contracts.json` e testes de cenário (permitido, sem chave, deny, outro workspace, inativo) para arquivar.

## Validação
`permissions:check`, ESLint, testes da área e Playwright com sua conta: Engajamento sem o item; arquivar a Sofia, conferir que some e que restaurar volta.
