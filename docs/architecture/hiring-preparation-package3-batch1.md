# APROVA-SOLICITA — pacote 3, lote 1

Porte G; previsão inicial 3–5 horas. Base solicitada `999fba45c` presente como ancestral direto; o checkout iniciou em `dd930138f`, contendo apenas tipos gerados adicionais. Essa alteração preexistente não foi absorvida nem alterada.

## Preparado e ensaiado

- Aprovações das solicitações existentes de profissionais/fornecedores, com chaves próprias para solicitar e decidir; nenhuma concessão a cargos.
- Gestor → CEO, duas decisões mesmo quando os papéis coincidem. Autor e solicitante não decidem; substituto somente explícito na política canônica. Área sem política permanece bloqueada; falta de acesso/inatividade gera pendência útil.
- Ciclo ligado à revisão salva, revisão do valor privado e snapshot da alçada. Edição salva (conservadoramente qualquer edição), valor e alçada invalidam pendentes/aprovadas. Eventos imutáveis; nenhuma projeção de valor em lista, eventos, contexto de aprovação ou notificação.
- Ficha mantém wizard e White Label; histórico central, resumo/ações lateral, motivo obrigatório, erro/loading, bloqueio com alterações não salvas. Links `?request=<uuid>` abrem a solicitação por leitura autorizada, sem depender da primeira página da lista.
- Notificação interna idempotente apenas da etapa atual, tipo distinto do ATS para não acionar fila de e-mail; corpo genérico sem título/escopo/valor. Nenhum envio real executado.
- SQL revisável `docs/architecture/prepared-migrations/0375_hiring_preparation_approvals.sql`, fora do journal. Revoga ACLs herdadas de tabelas e todas funções novas; RPCs públicas de aplicação somente authenticated, helpers privados sem EXECUTE externo. FK composta request/workspace, RLS de leitura e escrita só pelas RPCs autorizadas. Depende de execução privilegiada de migration para helpers fechados sobre políticas e resolvedor privado; não usa service_role para consultas de entidades da interface.

## Arquivos

Criados: SQL preparado acima; `src/lib/hiring/requests/approval-types.ts`, `approvals.functions.ts`, `approval-panel.tsx`, `approval-postgres.test.ts`; este relatório.

Alterados: `src/lib/hiring/requests/preparation-screen.tsx`, `AGENTS.md`; rotas `src/routes/_authenticated/people.hiring-requests.tsx`, `contracts.supplier-requests.tsx`; `docs/security/permission-contracts.json`, `permission-key-catalog.json`; `docs/help/people/preparar-solicitacao-contratacao.md`, `docs/help/contracts/preparar-contratacao-fornecedor.md` (4→5); `src/lib/help/official-catalogue.json` (somente esses dois artigos); `roadmap.md`. Nenhum arquivo removido. Nenhuma migration antiga/journal/baseline editado.

## Validações efetivamente executadas

- `bun run permissions:check`: lote sem findings; gate global falha por **dois findings preexistentes** em `src/integrations/supabase/types.ts` (hash do contrato `whatsapp-cloud-database-types` e uncovered_source). Não foi regularizado fora do escopo.
- `bunx vitest run src/lib/hiring/requests/approval-postgres.test.ts src/lib/hiring/requests/boundary.test.ts`: **23/23** (18 SQL reais + 5 boundary). PostgreSQL oficial descartável por socket/porta local; claims sintéticas, resolvedores reais carregados de migrations. Não equivale a autenticação hospedada.
- SQL: permitido profissional/fornecedor, sem chave, deny, outro workspace, inativo; Área sem aprovador, autor/solicitante/substituto, ordem e mesma pessoa; invalidação material/valor/alçada/aprovação completa, nova revisão, privacidade, falta de chave sensível, idempotência e concorrência de solicitação/decisão/edição, ACL default e eventos imutáveis, rejeição/motivo.
- ESLint direcionado nos sete arquivos TS/TSX do lote: **0 erros**, dois avisos de tamanho (tela existente ampliada e suíte SQL). Corrigidos hook de rota, formatação e exigência UI equivocada de chave `.approval.view` inexistente; a UI verifica view da solicitação + chave própria, assim como o SQL.
- `bun run help:coverage`: **254/254**; catálogo local 436 artigos, Ajuda **não aplicada**.
- `git diff --check`: sem erros.
- `bun run verify:changed --dry-run ...`: apenas planejamento de comandos, **não execução do loop completo**; tipos/build não executados manualmente por restrição do ambiente. Build automático consultado: `build OK` após as edições.
- Playwright em `http://localhost:8080/people/hiring-requests`: timeout 20s antes do DOM; não houve validação visual ou sessão/fluxo autenticado.
- `bun run perf:check`: falha por ausência de `.verification/build.json`; não certifica performance.

## Revisão, segurança e limites

SQL ensaiado sob ACLs default amplas, com revogações comprovadas. Ambiguidades de variáveis/aliases SQL detectadas e corrigidas antes de os testes passarem. Nenhum segredo, valor privado ou cadastro real em logs. O motivo é texto livre fornecido pelo aprovador: não colocar nele salário/valor ou dados pessoais; não há campo automático de valor nos eventos.

Nenhuma configuração de alçada, grant de usuário/cargo, registro real, execução, financeiro, contratação, vaga, candidato, minuta, contrato, anexo ou assinatura criado/alterado. A aprovação permanece separada de `ready`; não autoriza pacote 4 nem recrutamento antes da assinatura. Não aplicado e não publicado. Pacote seguinte de formalização não implementado.

## Pendências para revisão independente

1. Revisar SQL/contratos e unir o trabalho local pelo processo do usuário, sem absorver outros commits.
2. CI completa, suíte anterior de preparação e aceite autenticado/visual (desktop/mobile/light/dark) permanecem não executados neste ambiente. A migração não aplicada impede exercitar as novas RPCs na ficha real.
3. Após aprovação e aplicação em ambiente isolado, abrir ambas URLs com `?request=`, salvar ready, solicitar, decidir gestor e depois CEO com motivo, verificar a notificação e nova leitura; editar valor/escopo/alçada e confirmar invalidação. Testar negados, deny, workspace estrangeiro e inativo por URL e RPC.
4. Aplicação futura da migração e Ajuda exige revisão/autorização própria; nenhuma publicação automática.

Próximo passo recomendado: revisão independente deste lote, antes de formalização com os recursos de contratos existentes.