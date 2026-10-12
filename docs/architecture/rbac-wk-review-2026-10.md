# Revisão de cargos WK (workspace 184b9435…) — outubro/2026

Estado atual: as **Fases 0 e 1 foram aplicadas no banco compartilhado** (migration `0122_rbac_wk_phase1_structural`) e no código do servidor. Elas não foram publicadas. As Fases 2, 3 e 4 continuam pendentes.

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
