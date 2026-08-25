# Reduzir o tempo de publicação (build)

## Diagnóstico

O publish demora porque o build de produção hoje gera praticamente **um único pacote gigante** com o app inteiro, e o app é grande: 347 arquivos de rota, ~1.025 arquivos TS/TSX, 103 dependências.

Dois fatos confirmados no projeto:

1. **A divisão automática de código das rotas está desligada.** Em `vite.config.ts` existe `codeSplittingOptions.defaultBehavior: []`, com um comentário explicando que foi desativada de propósito para evitar um bug de duplicação do React/Router em chunks lazy. Efeito colateral: todas as 347 rotas entram no bundle principal, então o Rollup precisa transformar, tree-shakear e minificar tudo de uma vez.
2. **Bibliotecas pesadas são importadas de forma estática**, mesmo sendo usadas em uma ou duas telas:

| Biblioteca                         | Usada em                                      | Import atual                                                            |
| ---------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| `@tiptap/*` (18 pacotes)           | `word-editor.tsx` (2 telas)                   | estático                                                                |
| `@twilio/voice-sdk`                | `voice/call-dialer.tsx`                       | estático, dentro de `activity-timeline` (carregado em quase todo lugar) |
| `pdfjs-dist`                       | `cv-pdf-upload-button.tsx`                    | estático                                                                |
| `mammoth`                          | 2 diálogos de importação de contrato          | estático                                                                |
| `recharts`                         | 5 telas de dashboard                          | estático                                                                |
| `@ai-sdk/react` + `react-markdown` | `agent-drawer.tsx`, importado no `__root.tsx` | estático em **todas** as páginas                                        |

Como não há code splitting de rota, nada disso é isolado: tudo vira parte do mesmo trabalho de build (e do mesmo download no primeiro acesso do usuário).

## O que fazer

### Fase 1 — Medir (obrigatória antes de mexer)

Rodar o build atual e registrar tempo total e tamanho dos chunks, para ter linha de base. Sem isso não dá pra afirmar ganho.

### Fase 2 — Lazy load das bibliotecas pesadas (baixo risco)

Trocar import estático por `React.lazy` + `Suspense` (ou `await import()` dentro do handler) nos pontos acima:

- `WordEditor` → lazy nas telas `settings.clauses` e `proposals.$id`.
- `CallDialer` → lazy dentro de `activity-timeline` (só monta quando o usuário abre o discador). Maior ganho isolado, pois hoje o Twilio SDK entra em toda tela com timeline.
- `CvPdfUploadButton` (pdfjs) → lazy.
- `ImportContractFileDialog` e `ImportContractWizard` (mammoth) → lazy, já são diálogos.
- `AgentTrigger` (AI SDK + react-markdown) → manter o botão leve e carregar o drawer sob demanda; hoje sai do `__root.tsx`, ou seja, pesa em 100% das páginas.
- `recharts` → carregar os blocos de gráfico via lazy nas 5 telas de dashboard/analytics.

Cada componente lazy recebe fallback usando o `LoadingSkeleton` do design system, sem alterar layout final.

### Fase 3 — Reavaliar o code splitting de rota (risco médio, opcional)

Testar reativar `defaultBehavior: [["component"]]` em `vite.config.ts`. Isso restaura a divisão por rota e é o ganho estrutural maior, mas foi desligado por causa de um bug real de contexto nulo do Router. Validação necessária antes de manter: build de produção + navegação por rotas críticas (login, dashboard, leads, deals, ATS, admin) verificando que não reaparece `Cannot read properties of null (reading 'useContext')`. Se reaparecer, reverter e ficar só com as Fases 1–2.

### Fase 4 — Limpezas menores

- Revisar imports não usados de bibliotecas pesadas.
- Conferir se `src/integrations/supabase/types.ts` (18.763 linhas) está sendo puxado para o bundle do cliente além do necessário (tipos devem ser apagados na compilação, mas vale confirmar que não há import de valor).

## Expectativa realista

Fases 1–2 reduzem o bundle do cliente e o trabalho de minificação, mas o build continua sendo de um app grande — a melhora esperada é perceptível, não drástica. O corte maior de tempo depende da Fase 3, que é a que tem risco. Parte do tempo de publish (upload + propagação em CDN, ~1 min) não é otimizável pelo código.

## Fora de escopo

- Remover dependências ou funcionalidades.
- Alterar regras de negócio, RLS, autenticação ou schema.
- Redesenhar telas.

## Detalhes técnicos

- Arquivos tocados na Fase 2: `src/components/activity-timeline.tsx`, `src/routes/__root.tsx`, `src/routes/_authenticated/settings.clauses.tsx`, `src/routes/_authenticated/proposals.$id.tsx`, `src/routes/_authenticated/proposals.index.tsx`, `src/routes/_authenticated/contracts.index.tsx`, `src/routes/_authenticated/(ats)/candidates.index.tsx`, e as 5 telas que usam `recharts`.
- Arquivo tocado na Fase 3: `vite.config.ts` (apenas `codeSplittingOptions`).
- Validações a rodar: `bun run build`, `tsgo` (typecheck), `bun run lint`, e navegação manual nas rotas críticas.
