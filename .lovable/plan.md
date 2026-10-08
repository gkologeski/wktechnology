# Auditoria e plano de performance do TechERP

Nada foi alterado: nem código, nem configuração, nem dados. Nada foi publicado. Abaixo, cada ponto vem marcado como **Medido** (rodei agora), **Fato** (li no código) ou **Hipótese** (precisa de confirmação).

## 1. Fatos medidos agora (sandbox: 16 CPUs, 32 GB)

| Item | Resultado |
| --- | --- |
| `tsgo --noEmit` 1ª execução | **54s**, exit 0 (Medido) |
| `tsgo --noEmit` 2ª execução (diagnóstico) | 1,7s; 3.483 arquivos; 744 mil linhas; 555 MB (Medido, com cache de sistema quente) |
| Arquivos TS/TSX em `src/` | 1.749 (Medido) |
| `src/integrations/supabase/types.ts` | 23.210 linhas (Medido; eram 20.672 em 31/08) |
| `src/routeTree.gen.ts` | 8.951 linhas (Medido) |
| Rotas autenticadas | 234; arquivos com `createServerFn`: 271 (Medido) |
| `.select("*")` em `src/lib` | 260 ocorrências (Medido) |
| `count: "exact"` | 95 ocorrências (Medido) |
| `refetchInterval` | 19 pontos (Medido) |
| Arquivos com Realtime | 16+ (deals, deals.$id, leads.$id, tasks, jobs, candidates, inbox.whatsapp, notificações, chat, timeline, branding) (Medido) |

Maiores arquivos escritos à mão (Fato): `extra-fields-editor.tsx` 1.692, `banking.functions.ts` 1.538, `hubspot.functions.ts` 1.433, `finance.banking.tsx` 1.385, `entity-list.tsx` 1.360, `calendar/engine.server.ts` 1.350, `settings.teams.tsx` 1.279, `ats.functions.ts` 1.250, `jobs.index.tsx` 1.176, `tasks.tsx` 1.151.

## 2. Verificação automática: o que se sabe

- **Fato**: os scripts locais (`typecheck`=tsgo, `typecheck:inc`, `verify` em paralelo) já existem. O tempo limite de 240s acontece na verificação da própria plataforma, cujo comando exato **não está visível** no sandbox. O log `/tmp/observability` não existe neste turno.
- **Medido**: tsgo frio leva 37–54s. Isso **não prova** que o tempo limite não venha de tipos: o comando real da plataforma é desconhecido. O build sozinho mede 212–256s.
- **Hipótese principal**: a plataforma roda `tsc` sem cache (medido antes em 2m25s, quando `types.ts` era 11% menor) e/ou o build de produção. Somados, passam de 240s.
- **Falta medir**: o comando real da plataforma, CPU e RAM durante esse passo, e as fases do `vite build` (cliente, servidor e worker separados).

## 3. Principais gargalos (por ordem de impacto)

**Para o usuário (telas lentas)**
1. **Consultas largas**: 260 `select("*")` e 95 contagens exatas. Contagem exata não percorre necessariamente a tabela inteira, e onde a exatidão comercial importa ela deve ser mantida. (Hipótese de impacto; medir antes)
2. **Realtime + intervalos sobrepostos**: negócios, leads, tarefas e Inbox assinam mudanças e também têm `refetchInterval`. Em workspaces movimentados isso gera tempestades de recarga. (Fato; impacto é Hipótese)
3. **Provedores globais em `__root.tsx`** (Auth, I18n, Branding com Realtime, AgentTrigger, NewVersionWatcher): tudo carrega em toda tela, inclusive nas públicas. (Fato)
4. **Detalhe do negócio e timeline**: vários painéis buscam dados em paralelo, cada um com sua própria verificação de RLS; políticas restritivas de visibilidade por cargo (`rep_scope_*`) somam custo a cada linha. (Fato; custo é Hipótese)
5. **Listas grandes sem virtualização** (`entity-list.tsx`, Kanban com mais de 500 cards). (Fato, conforme a documentação)

**Para o build e a verificação**
6. `types.ts` cresce a cada migração e é importado por quase todo o grafo de tipos. (Medido)
7. `routeTree.gen.ts` com 234 rotas autenticadas. (Medido)
8. Arquivos de mais de 1.000 linhas atrasam o transform e o recarregamento ao vivo durante a edição. (Fato)

**Sem telemetria real** (declarado): não há tempos p50/p95 de tela, nem medições de consultas lentas ou de saúde do banco neste turno. Nada acima é estimativa apresentada como medição.

## 4. Dividir o projeto? Avaliação

| Opção | Ganho no build | Ganho para o usuário | Compatível com TanStack/Lovable | Recomendação |
| --- | --- | --- | --- | --- |
| Monólito modular (fronteiras por módulo, regras de lint, pastas por domínio) | médio | indireto | total | **Sim** |
| Project references do TS (pacote `db-types`, `ui`, módulos) | alto no typecheck incremental | nenhum | parcial: precisa de `composite`, e o Vite ignora | Avaliar depois da Sprint 1 |
| Serviços ou apps separados por módulo | alto | risco de piorar (vários logins, cache e marca) | baixo: um único worker e um único `routeTree` | **Não** agora |

Conclusão: dividir em serviços **não** resolve a lentidão das telas, que vem de consultas e recargas. A divisão em partes faz sentido só dentro do mesmo app.

## 5. Sprints (cada uma depende da anterior)

**Sprint 0 — Baseline (esforço P, risco nenhum)**
- Consultas lentas e saúde do banco (somente leitura), tamanho das tabelas, varreduras sequenciais.
- Tempos do `vite build` por fase; tamanho dos pacotes por rota; tempo até a tela ficar utilizável (Playwright) em: painel, lista de negócios, detalhe e timeline, Inbox/WhatsApp, Prospecção/Agentes, Projetos e TechHire.
- Pedir à plataforma o comando exato da verificação.
- Aceite: tabela de baseline registrada em `docs/architecture/performance-baseline.md`.

**Sprint 1 — Consultas (esforço M, risco baixo, rollback revertendo o commit)**
- Trocar `select("*")` por colunas projetadas nas 6 áreas prioritárias.
- Revisar `count: "exact"` só onde a medição apontar custo e a exatidão não for comercialmente exigida.
- Índices apenas a partir de EXPLAIN de consultas interativas reais; nada de índices genéricos.
- Aceite: p95 das consultas das listas abaixo de 300 ms; nenhuma regra de RLS alterada.

**Sprint 2 — Recargas e cache (M, risco médio)**
- Realtime e reconciliação periódica podem coexistir de forma controlada, com filtro por registro e agrupamento.
- Agrupar invalidações (debounce) e restringir as assinaturas a `workspace_id`.
- Chaves de cache sempre com `workspaceId`, e cache limpo ao trocar de workspace ou no "Ver como" (isolamento entre clientes).
- Aceite: no máximo 1 recarga por evento; trocar de workspace não mostra dado anterior.

**Sprint 3 — Carga inicial (M, risco baixo)**
- Carregar o AgentTrigger e o NewVersionWatcher só depois da tela pronta; Branding sem Realtime nas rotas públicas.
- Virtualizar `entity-list` e Kanban.
- Aceite: código JS inicial menor que a baseline em 20% ou mais; lista com 1.000 linhas fluida.

**Sprint 4 — Filas e escalabilidade (M, risco médio)**
- Auditar as rotinas agendadas (`*-tick`): lote máximo, lease, idempotência, recuo ao repetir, divisão justa entre workspaces.
- Aceite: um workspace grande não atrasa os outros; nada é processado duas vezes.

**Sprint 5 — Build e verificação (M, risco baixo)**
- Dividir arquivos apenas onde a medição mostrar ganho; nada de fragmentação cega.
- Fronteiras de módulo por regra de lint.
- Só depois disso, testar project references num ramo separado.
- Aceite: verificação da plataforma abaixo de 180s, sem desligar tipos, lint ou testes.

## 6. Metas propostas (budgets)

- Tela utilizável abaixo de 2,5s (p75); consulta de lista abaixo de 300 ms (p95); detalhe do negócio com no máximo 6 requisições.
- Código JS inicial por rota até 250 KB gzip.
- tsgo frio até 60s; build de produção até 150s; verificação da plataforma até 180s.

## 7. Segurança

Nenhuma mudança afrouxa RLS, RBAC ou a visibilidade por cargo. Cache e Realtime sempre ficam limitados ao workspace. Índices e projeções não alteram permissões.

## 8. Plano de carga futuro

Usar um workspace sintético isolado, nunca produção. Escala de 1, 10 e 50 usuários simultâneos nas 6 telas prioritárias. Sem e-mails nem mensagens: integrações simuladas. Só com sua autorização explícita.

## Detalhes técnicos

- Fontes: `package.json` (scripts), `tsconfig.json:16-18` (cache), `src/routes/__root.tsx:13-22` (provedores), `src/router.tsx:62-78` (defaults do Query), as contagens com `rg` citadas acima e a medição com `tsgo --extendedDiagnostics`.
- Não executado neste turno: consultas lentas e saúde do banco, tempo do build por fase, Lighthouse e Playwright. Tudo isso faz parte da Sprint 0.
