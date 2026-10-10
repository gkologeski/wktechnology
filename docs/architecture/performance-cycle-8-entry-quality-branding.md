# Performance — ciclo 8 (10/10/2026): gate completo, carga inicial, tempo real do White Label — preview, não publicado

Ambiente: sandbox de desenvolvimento, 8 núcleos, 31 GB, Vite 7.3.1, `dist/` apagado antes de cada build,
builds em sequência (nunca sobrepostos entre si). Medição: `/tmp/perf8/measure.sh` = `bun run build` sob
`/usr/bin/time -v` + `scripts/perf/chunk-closure.py` (fechamento de imports estáticos: entrada + chunk da
rota + dependências; "chunks" = número de arquivos JS que a rota baixa). Nada publicado, enviado ou
alterado em dados de clientes.

## 1. Gate completo — entregue e verde

- Lista real via `eslint -f json .`: 43 arquivos, 503 erros, **todos `prettier/prettier`**.
- `prettier --write` só nesses 43 arquivos (nenhuma regra desligada, nenhum ignore novo).
- Conferência semântica automática: comparando cada arquivo com a versão anterior sem espaços, vírgulas,
  `;` e parênteses, só 1 diferença — `template-import-client.ts` ganhou o `|` inicial de um tipo união
  quebrado em linhas (mesmo tipo). Nenhum texto de produto mudou.
- `bun run verify` (tipos + lint + testes): **exit 0** — 0 erros de lint (1.275 avisos, inalterados),
  104 arquivos / **723 testes**. Repetido no fim do ciclo: exit 0, 40 s.

## 2. Carga inicial — dois experimentos medidos, ambos revertidos

Linha de base A1 (mesmo commit do fim do ciclo 7, gzip): entrada 269.940; login 304.446 (6 chunks);
dashboard 348.093 (56); settings 308.148 (55); prospecting 433.879 (125); inbox 359.153 (69).

| Experimento | Entrada gzip | Efeito nas rotas | Decisão |
| --- | --- | --- | --- |
| B1: tirar `sections`/`getSettingsForScope` de `settings.tsx` para `src/lib/settings-nav.ts` | 269.939 (igual) | todas iguais (±80 B) | **Revertido**: a cadeia "settings → lucide" do ciclo 7 era só o 1º importador de ícones que a entrada já usa; não havia peso causal. `getSettingsForScope` não tem consumidores. |
| B2: `ConfirmDialogHost` carregando a interface (Radix AlertDialog) sob demanda | 261.287 (−8,6 KB) | login −8,3 KB; dashboard +2,4 KB (64 chunks); settings +2,2 KB; prospecting +4,1 KB; inbox +5,6 KB | **Revertido**: a entrada encolheu só escondendo código que as telas logadas baixam mesmo assim (Radix é compartilhado), e o total delas subiu. |

`zod` (~135 KB raw atribuídos ao `dashboard.tsx`) é usado por `validateSearch` de dezenas de rotas, que
ficam no pacote principal por desenho (só o `component` é dividido): não há como tirá-lo sem mudar o
code-splitting do roteador — fora de escopo sem prova.

Estado final F (com a mudança do item 3): entrada 270.519 gzip (+579 B pelo novo código do White Label em
`branding.tsx`, que está no shell); demais rotas +~600 B pelo mesmo motivo. Tempo de build: A1 135 s,
B1 204 s, B2 123 s, F 116 s; pico de memória 7,26–7,34 GB. A variação de 116–204 s com o mesmo código
mostra que o tempo de build aqui **não serve para comparar mudanças pequenas**.

## 3. Tempo real do White Label — implementado; assinatura aceita; evento ponta a ponta não comprovado

Achado: a assinatura recusada era em `profiles` (`UPDATE id=eq.<usuário>`), usada para recarregar o
branding ao trocar de workspace. `profiles` não está na publicação e **não foi adicionada** (tabela com
dados pessoais e SELECT entre colegas). As tabelas de branding não tinham tempo real nenhum.

Mudança:
- Migration aditiva `drizzle/migrations/0098_branding_realtime_publication.sql`: adiciona à publicação só
  `workspace_branding` e `module_branding` (cores, logos, fontes, domínio; sem segredos). SELECT continua
  restrito a membros do workspace (RLS existente, inalterada).
- `src/lib/branding.tsx`: assinatura por `workspace_id=eq.<workspace carregado>` nas duas tabelas;
  detecção da recusa silenciosa (`system` + `status:error`) e `CHANNEL_ERROR/TIMED_OUT` com nova
  tentativa 5 s → 60 s; rajadas coalescidas (300 ms); respostas de carga antiga descartadas por sequência;
  troca de workspace refaz a assinatura; aba oculta fecha o canal e, ao voltar, recarrega (reconciliação)
  e reabre; cleanup ao trocar usuário/"Ver como" (efeito por `user.id`).
- Troca de workspace: `notifyWorkspaceChanged()` (evento na aba + `BroadcastChannel` para outras abas) no
  seletor de workspace, substituindo a escuta de `profiles`. Trocas feitas no servidor por outros
  caminhos (vínculo de times) só aparecem ao voltar à aba/recarregar — limitação registrada.
- `src/lib/workspace-events.ts` + testes (3): filtros só das 2 tabelas presos ao workspace, rejeição de
  workspace inválido (sem filtro aberto/injetado), espera limitada.

Validação real, só leitura (Playwright no preview, sessão do próprio usuário): o servidor respondeu
`phx_reply status ok` com as duas assinaturas e `system: "Subscribed to PostgreSQL", status ok` em todas
as 6 telas abertas. **Entrega de evento não comprovada**: exigiria alterar o branding de um workspace
real; não há banco isolado com o serviço de tempo real disponível.

## 4. Verificação automática da plataforma

Neste ciclo, o log `/tmp/observability/build-errors.log` registrou 12 verificações (00:24–00:53 UTC):
11 "build OK" e 1 com erro de tipo real e transitório (editor no meio da alteração do item 3, corrigido
na seguinte). **Nenhum encerramento por 240 s**, inclusive com os builds deste ciclo rodando em sequência.
Uma execução minha de `tsgo` foi morta pelo limite de 200 s da minha ferramenta logo após uma edição
(reexecução: 36 s) — sem causa identificada. O comando da plataforma segue desconhecido; nada aqui prova
causa nem correção.

## 5. Verificação final

- `bun run verify`: exit 0 (tipos, lint global 0 erros, 723 testes). `bun run build`: exit 0 (116 s).
- Smoke autenticado read-only: `/settings/branding`, `/dashboard`, `/prospecting`, `/inbox`, `/deals`,
  `/settings/permissions` abriram com título, sem erros de página. Nenhuma conversa WhatsApp aberta;
  nenhuma configuração ou permissão alterada.
- SSR de produção: `vite preview` não funciona com o preset Cloudflare/Nitro (`dist/server/server.js`
  inexistente — o artefato é um worker). Não exercitado.

## Rollback

- Formatação: só espaços; reverter os 43 arquivos não muda comportamento.
- White Label: voltar `branding.tsx`/`workspace-switcher.tsx` à versão anterior; a publicação das duas
  tabelas pode ficar (inofensiva) ou sair com `ALTER PUBLICATION supabase_realtime DROP TABLE ...`.

## Pendências (próximo ciclo)

1. Observabilidade: registrar duração/memória por fase de build e por verificação automática (sem
   segredos) para ter amostras comparáveis; tempo de build atual tem ±40% de ruído.
2. Carga isolada: banco descartável com serviço de tempo real para provar evento ponta a ponta (branding,
   e-mail, histórico) e RLS não-admin com políticas reais.
3. Contratos por módulo: zod no pacote principal só cai com mudança no code-splitting de `validateSearch`
   — avaliar com medição, não por suposição.
4. RLS não-admin no banco real: continua não validada (requisito de publicação).
5. Fase nitro (~46 s) e timeout de 240 s da plataforma: sem comando visível; seguem em observação.
