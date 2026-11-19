# Pacote 5 — Segurança, integração e aceite

Escopo aprovado em 18/11/2026: testar permitido, sem chave, deny, outro workspace e inativo, integração, Ajuda, CI, publicação e aceite dos pacotes 2–4. Não corresponde à antiga etapa 5 da integração ATS. Autorização de implementação e publicação confirmada em 19/11/2026, juntamente com o fluxo de contratos legados.

## Base e limites

Base publicada: main `50f3300aea3e292e8494757deb418571854eb92a`, PR #43. As migrações 0381–0384 já estão aplicadas e não devem ser reaplicadas. O pacote 5 reaproveita as fronteiras e cenários reais existentes; acrescenta verificações de integração onde houver lacuna, sem novos grants automáticos ou atalhos de autorização. A regularização de contratos legados é uma entrega distinta e não pode substituir aprovação, formalização, assinatura ou início de uma nova contratação.

## Matriz de revisão

| Fronteira | Fonte executável | Evidência adicional |
| --- | --- | --- |
| Solicitação e referência privada | preparation-postgres.test.ts | Mesma origem/pessoa/empresa, revisão, dados privados, RLS canônica |
| Gestor e CEO | approval-postgres.test.ts | Ordem, autoaprovação, alçada atual, idempotência e notificação interna |
| Formalização e assinatura | formalization-postgres.test.ts | OTP real de fixture, expiração, anexos, todos os signatários, hash, preservação histórica |
| Início e alocação | execution-postgres.test.ts | Gestor atual, origem direta, CNPJ, dedicação simultânea, regressão ATS e ausência de IAM |
| Entrega e documento fiscal | deliveries-postgres.test.ts e fiscal-attestation.server.test.ts | Versão exata, separação de atores, arquivo privado e bytes atestados no servidor |
| Plano e provisão | economics-postgres.test.ts | Preço explícito, Financeiro nomeado, competência encerrada, fontes canônicas, previsão separada de dívida |
| Títulos e conciliação | payables-postgres.test.ts | Fonte única, saldo documental, parcelas canônicas em aberto, proteção do legado e ausência de pagamento |

As suítes estão em `src/lib/hiring/requests/`. Os cinco cenários são testes de RPC/SQL em PostgreSQL descartável, além dos gates de servidor e UI; mocks de retorno falso não substituem os cenários do banco. Os fixtures não aceitam URL de produção e restauram gatilhos antes das operações exercitadas. Preparar conexões antes do teste não muda seus limites nem elimina a concorrência.

## Complementos desta revisão

- Para profissionais e fornecedores, remover a chave de geração do módulo correto e manter a do outro módulo não autoriza a ação. Deny explícito continua prevalecendo. Nenhum título, claim de origem ou pagamento pode ser criado pela tentativa negada.
- Para ambas as origens, a sessão `Ver como papel` mantém os indicadores de escrita desabilitados e a RPC de geração nega a tentativa, mesmo com grants financeiros. Leitura de contexto e tentativa de mutação são transações distintas para verificar também o rollback real.
- Conferir, após a nova migração de legados, que nenhuma marcação de importação/metadata permite converter um contrato de contratação governada para fugir dos gates acima.

- Auditoria encontrou que `hiring_execution_activation_ok` não revalidava a autoridade atual do gestor, embora o contexto de início já o fizesse. A migração aditiva preparada 0386 inclui a identidade do gestor atual (sem autoaprovação) e `hiring_execution_subject` no predicado de novas operações, preservando a verificação existente de assinatura, revisão e aprovação vigente; preserva ACL, histórico do início, vínculo e alocações anteriores. Quatro novos cenários pós-início (sem chave, deny, inativo e workspace trocado) negam a nova alocação.
- As quatro suítes de execução, entregas, economia e títulos carregam também a 0386: 216 testes aprovados em PostgreSQL 16 descartável local, em 19/11/2026. A CI PostgreSQL 17 ainda é obrigatória.

- Integração cruzada carrega a 0385 ao lado das migrações e funções reais de contratação no fixture de títulos. Profissional e fornecedor iniciados, com assinatura completa real de fixture, não podem ser reconhecidos como legado mesmo com caminho de importação. As 73 verificações passaram localmente; contratos, início e pagamentos são preservados.

## Fechamento obrigatório

1. Revisar alterações e executar `permissions:check` antes de tipos, lint e testes direcionados. Não regenerar baseline nem alterar migrações históricas.
2. Executar integração em banco descartável, incluindo o novo fluxo de legados e as regressões de contratação/vendas/financeiro/arquivos privados. Não emitir assinaturas, convites, notas, títulos ou pagamentos reais durante QA.
3. Validar Ajuda versionada e os seletores/URLs com autorização. Preservar alçadas, encaminhamentos, overrides e pacotes locais por comparação de hashes antes/depois.
4. Uma revisão estável deve passar na CI completa, build e performance, sem bypass. Aplicar somente migrações revisadas, com journal e hashes conferidos.
5. Publicar a revisão autorizada e comparar o fingerprint da CI com os dois domínios oficiais. Conferir telas e Ajuda na sessão administrativa e negar URLs diretas ao perfil restrito; restaurar a sessão original.
6. Relatar separadamente testes SQL isolados, testes de componentes e navegação de produção. E2E autenticado opt-in não configurado é `skipped`, nunca aprovação. Nenhuma observação de menu ou mock constitui prova de uma transação operacional real.

## Estado

Auditoria e complementos em execução. A primeira CI aprovou 3.983 testes e build, mas recusou 362,5 s de verify (limite 240 s); a 0386 foi ajustada para não repetir o preflight completo de início depois de já validar assinatura/revisão/aprovação. A autoridade atual continua sendo revalidada, com os mesmos testes de revogação. A segunda CI manteve os 3.983 testes aprovados e caiu para 290,5 s, ainda acima do limite. O teste com workers em threads foi revertido: os testes de fuso precisam da alteração de TZ por processo. O executor original por processos e todos os testes e limites permanecem. O cache verificado de lint já reduziu essa etapa a 1,9 s na terceira CI, que terminou em 220,8 s, mas teve duas falhas de fuso causadas pelo experimento e não foi aprovada. A restauração dos mesmos snapshots descartáveis envia as mesmas operações em lote, sem alterar as RPCs exercitadas. A nova entrega ainda não foi aplicada nem publicada. Evidências locais em `outputs/contracts-legacy-package5-2026-11-19/` da tarefa Codex; o relatório final substituirá este estado após a validação efetiva.
