# Correção dos cargos da WK (workspace 184b9435…)

Escopo exclusivo da WK. Nada é apagado, nenhum administrador é rebaixado e nenhum envio é disparado. Cargos e pacotes globais de outros workspaces não são alterados: toda mudança vai para pacotes locais da WK, overrides da WK ou proibições (denies) da WK.

## Fase 0 — Foto antes e reversão
- Tabela de backup `rbac_wk_backup_2026_10` com o estado atual de defaults, overrides, conjuntos e vínculos de cargo da WK.
- Função de reversão que restaura essa foto exatamente.
- Auditoria por linha em `access_audit_log` (cargo, chave, concedida/negada, motivo).

## Fase 1 — Correções estruturais no banco (testadas antes no ambiente isolado)
1. `user_effective_permissions`: exige membro ATIVO (inclusive para bypass de admin); denies sempre prevalecem; passa a considerar defaults do cargo.
2. `job_roles_ws_update`: só owner/admin altera cargos; não-admin nunca muda `is_system`, dono ou workspace.
3. `role_profile_approve`: usa `role_profile_resolve_leader` + aprovação pendente + visibilidade do negócio; não-líder negado; admin só como exceção explícita registrada em auditoria.
4. Chat ao vivo: listar/enviar/encerrar com `assertPermission` no servidor; políticas de `live_chat_messages` vinculadas à visibilidade da sessão; Auditor/somente leitura sem envio; Rep/QA sem mensagens de terceiros. Fallback das chaves legadas de Inbox explícito e testado.

## Fase 2 — Matriz dos 16 cargos (migration idempotente)
- Apontador: materializar as 12 chaves own em pacote local, sem tocar nos demais.
- Perfis de vaga:
  - Vendedor, Vendedor Interno, Rep. Externa: ver/criar/editar.
  - Gerente Comercial: ver/criar/editar/gerenciar/compartilhar; aprovar só como líder validado.
  - Diretor: ver/gerenciar/compartilhar.
  - Recrutador, Head RH, Gerente Técnico: ver/editar.
  - Financeiro, Head Financeiro, Colaborador Externo, QA: nada extra.
  - Histórico comercial não ampliado; aprovação antecipada fica com admin, sob auditoria.
- Visibilidade total: denies da WK em Financeiro/Pessoas/configuração para cargos operacionais, preservando o que o CRM precisa (catálogo, presets, cargos, solicitação, recrutamento).
- Rep. Externa: denies das exclusões amplas herdadas do Sales Rep (atividades, emails, reuniões, cotações, chamados, WhatsApp) e aliases; leitura/envio own mantidos.
- Colaborador Externo: só participações próprias, mantendo contratos/projetos específicos.
- Auditor: somente leitura (remove `techprojects.folders.update.workspace` e afins). Os admins com o cargo seguem admins e aparecem sinalizados.
- Documento `docs/architecture/rbac-wk-review-2026-10.md` com as decisões por cargo (concedido/revogado/motivo).

## Fase 3 — Tela /settings/permissions
- Cada célula mostra a permissão efetiva e de onde vem: cargo, conjuntos extras, cargos somados, deny, bypass de admin.
- Dependências: commercial/create/update/approve/manage/share exigem ver; a tela bloqueia combinação inconsistente nova e mostra conflito com deny, sem conceder por cima dele.
- Aviso quando um admin tem cargo somente leitura (precisa de decisão nominal).
- "Restaurar padrões" usa a baseline da WK, não a global.

## Fase 4 — Provas e aplicação
- Ambiente isolado com login real (GoTrue/JWT): próprio/equipe/terceiros/outro workspace/inativo/anônimo; não-admin alterando cargo → negado; líder × não-líder; chat sem permissão/restrito/Auditor × operador; deny + soma de 2 cargos; antes/depois de cada cargo. Teste não executado = não aprovado.
- Gates verify + build completos.
- Aplicação no banco compartilhado só das migrations aprovadas, seguida da leitura das permissões efetivas reais.
- Sem publicação automática: as mudanças do chat ao vivo e da tela dependem de lançamento coordenado.

## Pendências que dependem de decisão humana
- Quem continua admin/owner (8) e os 2 admins sem cargo.
- Líder canônico por negócio, quando não puder ser resolvido.

## Execução
Por causa do tamanho, entrego em turnos e fecho cada fase antes de abrir a próxima: 0+1 → 2 → 3 → 4. Cada entrega traz relatório e evidências.
