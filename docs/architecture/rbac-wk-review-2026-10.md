# Revisão de cargos WK (workspace 184b9435…) — outubro/2026

Estado atual (12/10/2026): as **Fases 0, 1, 2, 3 e 4 foram aplicadas** no banco compartilhado (migrations `0122`, `0123`, `0124`, `0125`, `0126`) e no código do servidor e da interface. Nada foi publicado. Pendem apenas o reteste das asserções pelo usuário e a publicação coordenada.

## Fase 0 — foto e reversão
- `rbac_wk_backup_2026_10` guarda 393 linhas: overrides, cargos locais, vínculos cargo↔pacote, cargos dos usuários, conjuntos extras e o código anterior das 4 funções alteradas.
- `rbac_wk_restore_overrides_2026_10()` restaura os overrides da WK a partir da foto. Só o `service_role` pode executá-la, e cada restauração é registrada em `access_audit_log`.
- A foto é tirada uma única vez: se a migration for reaplicada, ela não é sobrescrita.

## Fase 1 — correções estruturais
| Item | Antes (medido no isolado) | Depois |
|---|---|---|
| Permissões de membro inativo | `true` (mantinha as chaves) | `false`; inclusive no bypass de admin/criador |
| Membro comum renomeia cargo | `rows=1` | `rows=0`; admin de outro workspace também é barrado |
| Admin marca cargo como sistema | permitido | `42501` (bloqueado por gatilho) |
| Chat, usuário com escopo próprio | via 3 sessões | via só a sua; equipe vê a equipe e a fila; workspace vê todas |
| Envio no chat | qualquer membro | exige a chave de criar, sessão visível e autor = o próprio usuário |
| Aprovação de perfil pelo legado, não-líder com chave | aprovava | `LEADER_REQUIRED` |
| Admin pelo legado | aprovava | `LEADER_REQUIRED`; precisa do override com motivo (≥10 caracteres), que fica auditado |
| Líder sem a chave approve | aprovava | `PERMISSION_DENIED` |
| Líder com membership inativa | contava (`<> 'inactive'`) | só conta `status = 'active'` |

No servidor:
- O chat ao vivo (`listChatSessions`, `listChatMessages`, `sendChatMessage`, `closeChatSession` e `convertChatSessionToTicket`) agora chama `assertAnyPermission`.
- A decisão do líder confere, pela RLS do próprio usuário, se ele enxerga o negócio.
- A mensagem `LEADER_REQUIRED` foi traduzida e explica o caminho: pedir ao líder ou usar o override.

Não foi adotado: somar os defaults dos cargos nas permissões efetivas. Isso concederia chaves novas em todos os workspaces. A baseline da WK será materializada em pacotes locais na Fase 2.

## Evidências
- Isolado com GoTrue + PostgREST reais e JWT de login por senha, `scripts/isolated-db/stack/rbac-wk-phase1.ts`: **37 PASS / 0 FAIL**. Foram 4 observações antes da migration. A reaplicação da migration também passou.
- Regressão `sdk-e2e.ts` depois da 0122: 26 PASS / 0 FAIL / 6 não executados. Esses 6 dependem de tempo real e já estavam assim antes; não contam como aprovados.
- Banco real depois de aplicar:
  - 7 políticas novas.
  - 0 membros inativos com chaves.
  - Owner continua com 1.657 chaves e o Gerente Comercial multi-cargo com 731.
- Gates: verify `complete=true` (53,8 s; 773 testes) e build exit 0. Para o lint passar, também foram corrigidos erros que já existiam: formatação em 5 arquivos e uma regex de controle em `login.tsx`.

## Impacto e lançamento
- O site publicado ainda usa o servidor antigo. Mesmo assim, as regras novas já valem no banco:
  - quem não é líder (inclusive admin) recebe erro ao aprovar pelo botão antigo;
  - quem não tem a chave de chat deixa de ver as sessões.
- Os gestores (Diretor/Gerente Comercial) têm só `chat.view`, sem `chat.create`. Por isso não enviam mais no chat, como prevê a matriz.
- O botão de override no quadro de perfis de vaga ainda não existe (Fase 3b). Até lá, o override é só pelo banco/servidor.

## Pendências
- Fase 2: matriz dos 16 cargos.
- Fase 3/3b: tela de permissões efetivas e o botão de override.
- Fase 4: provas por cargo e leitura efetiva real.
- Publicação coordenada.
- Decisões humanas: 8 admins/owners, 2 admins sem cargo e admin com cargo Auditor.

## Fase 2 — baseline da WK (migration 0123, aplicada)

- Os pacotes locais passaram a ter `workspace_id` da WK. Pacotes de outro workspace não valem mais aqui (teste isolado `A-pacote-outro-ws`).
- Os defaults continuam **fora** do cálculo automático: servem só de preset e restauração.
- Execução real: 39 concessões, 1.031 proibições, 1 chave de escrita retirada do pacote local do Auditor.
- Em seguida, 126 proibições novas foram retiradas porque a mesma chave já vinha de outro cargo acumulado da pessoa; nenhuma proibição anterior foi tocada.
- Resultado por pessoa (antes → depois):
  - Apontador: 0 → 12 (os 12 padrões, escopo próprio).
  - Gerente Comercial + Financeiro + Diretor: 731 → 737 (+6 de perfis de vaga).
  - Gerente Comercial + Head de RH: 701 → 627 (+6 perfis de vaga; −80 de configuração de sistema e financeiro).
  - Representante de Vendas (externa): 126 → 123 (+3 perfis de vaga; −6 exclusões amplas de atividades, e-mails, reuniões, cotações, chamados e WhatsApp).
  - QA: 23 → 23.
- Nada foi alterado em cargos ou pacotes globais de outros workspaces.

## Fase 3 — tela de permissão efetiva (preview)

- `/settings/permissions` ganhou o quadro "Permissão efetiva por pessoa": mostra a lista real do banco e a origem de cada chave (cargo, conjunto extra, concessão, proibição, acesso de administrador), com aviso de acúmulo de cargos, de membro inativo e de administrador com cargo somente leitura.
- A lista vem de `effective_permissions_array`, que devolve tudo de uma vez (a leitura em páginas cortava admins em 1.000 chaves) e só responde para a própria pessoa ou para admin do workspace.
- Conceder/revogar passou a respeitar dependências: ações de perfis de vaga exigem a permissão de ver perfis; revogar a base é barrado enquanto houver ação dependente.
- "Restaurar padrões" deixou de apagar proibições e ajustes do cargo: ele recompõe o pacote local pela baseline da WK e recoloca apenas o que falta.
- Conferido no navegador com três pessoas reais: Representante de Vendas (123 chaves), administrador com cargo Auditor (1.657, com aviso de bypass) e gestora com três cargos (737, com aviso de acúmulo). As origens batem com o banco, sem divergências.

## Fase 4 — fechamento das brechas da prova independente (migration 0125, aplicada)

Origem: prova independente do usuário (GoTrue + SDK reais, 47 asserções, 12 pass / 35 fail antes das correções).

O que a migration 0125 passou a garantir:

- **Pacotes de permissão nunca globais.** Criar, alterar ou excluir pacote exige ser administrador do workspace e o pacote precisa ter workspace definido. Antes, um pacote criado pela tela nascia sem workspace e podia valer em outros clientes.
- **Vínculo cargo ↔ pacote (ACL) só por administrador do workspace do pacote.** Membro comum não liga nem desliga pacote de cargo pelo SDK.
- **Mensagens de chat seguem a visibilidade real da conversa** (permissão + escopo próprio/equipe/workspace + restrição de carteira), tanto para ler quanto para enviar. Antes bastava ser membro do workspace para ler mensagem de terceiros.
- **Aprovação de perfil de vaga exige enxergar o negócio.** Nova verificação explícita por posse/equipe/permissão (`deal_visible_to_current_user`), usada pelo fluxo do líder, pelo caminho legado e pelo override administrativo; o legado também passou a exigir solicitação pendente.
- **Apontador materializado em pacote local da WK**: 12 chaves no pacote do workspace e as concessões temporárias da 0123 removidas (usuário segue com 12 chaves).

Código do app: pacotes de cargo passaram a nascer com o workspace ativo; criar, duplicar e excluir cargo exigem administrador e gravam o workspace no cargo.

Validação executada (sem Docker, stack isolada com GoTrue + PostgREST reais e JWT de verdade):

- `scripts/isolated-db/stack/rbac-wk-phase1.ts` com a 0125: **42 pass / 0 fail / 4 observações antes da migration**.
- Casos novos: pacote criado por membro comum negado, pacote global negado mesmo para administrador, vínculo de pacote a cargo por não-admin negado, líder com a permissão mas com negócio fora do escopo negado.
- Gates: `bun run verify` completo (779 testes) e `bun run build` completo.
- Conferência no banco após aplicar: 12 itens no pacote local do Apontador, 0 concessões temporárias, 0 pacotes globais de cargo.

Pendente: reteste das 47 asserções pelo usuário e publicação coordenada (não publicado).

## Migration 0126 — fechamento do overload legado `user_has_permission(_user, _perm)`

Origem: apontamento do usuário (vendedor da WK que também é dono de outro workspace podia passar em políticas legadas com permissão que só tem no outro tenant) e prova isolada de vazamento de pacote local pelo mesmo cargo de sistema em outro workspace (48 asserções, 12 pass / 36 fail antes).

O que a 0126 garante:

- **Checagem legada de 2 argumentos não varre mais todos os workspaces.** Agora avalia apenas o workspace ativo canônico do perfil (`profiles.active_workspace_id`) com membership ativa, e falha fechado quando não há workspace ativo. Sem inferência de "primeiro workspace" e sem bypass por ser dono de outro workspace. A função fica marcada como depreciada, assim como `techhire_rbac_gate(_user, _perm)`.
- **Políticas migradas para 3 argumentos**: `prospecting_questionnaires` (update, delete) e `prospecting_questions` (update, delete) passaram a usar o workspace da própria linha. Não restou nenhuma política ou função de negócio usando o overload de 2 argumentos (apenas o gate depreciado, que não é chamado por nenhuma política).
- **Cargo e pacote presos ao workspace avaliado.** A resolução efetiva deixou de inferir workspace por "dono = criador do workspace", exige que o cargo atribuído seja do workspace ou de sistema, e rejeita pacote local (`__bundle__`) sem workspace. Defaults continuam fora da resolução, apenas como presets de restauração.

Validação executada:

- Isolado com GoTrue + PostgREST reais: **48 pass / 0 fail / 4 observações antes da migration**, incluindo os casos novos: 2 argumentos com workspace ativo WA → `false` para `techfinance.payments.delete.workspace`; 3 argumentos no workspace privado → `true`; 3 argumentos na WA → `false`; pacote da WA não vale em outro workspace pelo mesmo cargo de sistema (nos dois sentidos); pacote do próprio workspace continua concedendo.
- Comparação antes/depois no banco compartilhado, por usuário ativo: **0 permissões perdidas e 0 ganhas** (13 usuários, 14.778 chaves efetivas no total).
- Gates: `bun run verify` completo (779 testes) e `bun run build` completo.

Compatibilidade de jobs (cron, HubSpot, workflows): nenhum caminho do aplicativo chama o overload de 2 argumentos (verificado por varredura no código e no catálogo do banco); esses jobs já passam o workspace explicitamente. Nada publicado.
