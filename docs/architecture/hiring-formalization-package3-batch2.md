# FORMALIZA-SOLICITA — implementação revisável

Porte G; estimativa inicial 6–10 h. Código preparado, **não aplicado nem publicado; aceite completo ainda pendente**.

## Entrega funcional preparada

- Fronteira própria `hiring_formalization_current` revalida ambos aprovadores, revisão, referência privada, snapshot da alçada, membership e deny. Não altera 0375 nem helper local informado pelo usuário.
- Fábrica idempotente de contrato client e contract_draft sem deal/proposal falsos; profissional definido obrigatório; fornecedor exige empresa/contato e preparo por Jurídico listado.
- Etapas preparação → jurídico nomeado → link/OTP da contraparte → Financeiro nomeado → assinatura humana; rejeição/revogação e invalidação de documento/anexos/revisão/configuração. Sem execução/ativação/pacote 4.
- Token aleatório revogável, 7 dias; código oito dígitos, 10 minutos, cinco tentativas/desafio, quinze/capacidade, cinco envios e intervalo 60s. HMAC separado por domínio/token/desafio/código usando segredo existente AI_KEYS_ENCRYPTION_KEY. Código só em memória e template enviado ao destinatário canônico; challenge armazena digest privado. Falha/supressão nunca verifica. Consumo SQL atômico, nenhum atalho interno; colaborador pode aceitar próprio documento pelo e-mail.
- Ficha integrada, links de instrumento/minuta, responsáveis/prazos, notificações internas genéricas. /minuta adapta somente nova origem, downloads privados de anexos com hash, sem token ou código em lista/histórico.
- Nativa: adaptador preserva helper histórico e adiciona gate na preparação por contatos e público. ForSign/nativo revalidam também imediatamente antes de efeitos externos. Rótulos WK contratante/pessoa ou empresa contratada só na nova origem; hashes anteriores excluem a coluna nova nula.
- Quatro chaves novas de formalização sem concessões automáticas, RLS restritiva do conteúdo sensível, RPC/ACL fechadas. Migrações 0376/0377/0378 em prepared-migrations, fora do journal, somente revisáveis.
- Ajuda dos dois artigos 5→6 e catálogo local; não aplicada. Template hiring-draft-code registrado. Domínio de envio consultado: ativo; nenhum envio real feito.

## Arquivos

Criados: `docs/architecture/prepared-migrations/0376_hiring_formalization.sql`, `0377_hiring_formalization_boundaries.sql`, `0378_hiring_signature_adapter.sql`; `src/lib/hiring/requests/formalization-types.ts`, `formalization.functions.ts`, `formalization-panel.tsx`, `formalization-postgres.test.ts`, `draft-code.server.ts`, `draft-code.test.ts`; `src/lib/email-templates/hiring-draft-code.tsx`; `tests/fixtures/hiring-formalization.sql`; este relatório.

Alterados: preparation-screen.tsx e AGENTS.md das solicitações; contract-draft-public.functions.ts, signature-delivery.server.ts, forsign-service.server.ts; minuta.$token.tsx; registry.ts de e-mail; dois artigos Ajuda e official-catalogue.json; permission-contracts.json, permission-key-catalog.json; roadmap.md. Nenhum removido. Nenhuma mudança no lote 1, types.ts gerado, baseline, migration antiga ou journal.

## Validações efetivamente executadas

- `bun run permissions:check`: contrato do lote sem findings; falha global pelos dois findings preexistentes de types.ts, a serem unidos pelo usuário.
- `bunx vitest run src/lib/hiring/requests/formalization-postgres.test.ts src/lib/hiring/requests/draft-code.test.ts src/lib/hiring/requests/approval-postgres.test.ts src/lib/hiring/requests/boundary.test.ts`: **42/42**, sendo 15 SQL formalização, 4 adaptador/HMAC e 23 do lote anterior.
- SQL real descartável: permitido, sem chave, deny, outro workspace, inativo, rechecagem gestor, fábrica concorrente, cadeia jurídica/OTP/Financeiro, bloqueios SQL de operações ForSign/evidência nativa, consumo concorrente, limites/reenvio/expiração, destinatário canônico, privacidade/ACL, falsificação de origem, bypass interno, invalidação material e corpo histórico de venda.
- ESLint direcionado: **0 erros, 24 avisos**, sobretudo tamanho/any já presentes nos serviços alterados. Prettier direcionado executado.
- `bun run help:coverage`: **254/254**. Catálogo 436 artigos; só dois alterados.
- `git diff --check`: passou. Build automático observado `build OK`; não executei tipos/build manualmente.
- `bun run verify:changed --dry-run ...`: só planejamento, **não** loop completo. Não alegar verify/CI completos.
- Playwright: timeout antes de DOM em localhost/people/hiring-requests; fluxo autenticado/UI não validado. Proibição de aplicar migrations também impede testar nova cadeia real no backend.

## Problemas corrigidos durante revisão

Checagem de permissões de terceiros por helper privado (introspecção pública do usuário não serve para aprovadores), porta descartável, invalidação não deve impedir edição inicial, hash histórico com coluna nova, tipagem de projeção pública, desafio com tentativas independentes. Provedor controlado não envia mensagens reais. Nenhum segredo/código foi impresso.

## Limites e pendências honestas

- Ensaio SQL usa schema sintético e fronteiras simplificadas de contratos/entidades, com resolvedores reais de permissions e SQL preparado. **Não equivale a integração com todo schema de produção.** Aplicação local integral, cadeia nativa com participantes completos/testemunhas e envio ForSign com adaptador de rede ainda precisam de regressão independente.
- Compra de fornecedor, CLT/freelance, aceite do próprio colaborador e URL/RPC com sessão hospedada não tiveram ensaio completo específico; os testes centrais cobrem profissional PJ sintético. Nenhum assinador externo real acionado.
- Aceite liga o hash ao conteúdo/anexos; downloads validam bytes. Nenhum snapshot PDF público foi exercitado. Rótulos/participantes/anexos integrais e congelamento precisam de validação visual na união.
- Revisão de concorrência completa com políticas/settings e ordenação dos locks de todos triggers existentes permanece necessária antes de aplicação. SQL preparado não é certificado de ausência de deadlock ou de efeitos disparados por todos triggers do sistema.
- RH é distinguido por chave própria do módulo; não por nome/cargo hardcoded. Não presumir a atribuição dessa chave a RH/Jurídico/assinatura na produção.
- Prazo do token é 7 dias fixo neste código, separado de prazos úteis dos responsáveis configurados; configuração específica de prazo de aceite ainda não existe.
- Motivo da conferência é obrigatório mas não prova, sozinho, suficiência jurídica do texto. Sem aprovação jurídica inventada. Notas não são copiadas aos eventos comuns deste novo fluxo.
- Interface mantém editor de contrato existente; documento de minuta é sincronizado no encaminhamento. Editor jurídico histórico de minuta não conclui a nova cadeia automaticamente; decisões próprias ficam na solicitação. Não afirmar todos controles antigos da ficha adaptados visualmente.
- Migration e Ajuda não aplicadas, não publicado. União das correções locais do lote 1, CI completa, testes autenticados e revisão SQL continuam pendentes. A implementação funcional está preparada, mas **não considerar o pedido integralmente validado/concluído**.

## Validação manual após revisão e aplicação isolada

Conceder explicitamente as chaves apenas às contas de ensaio, configurar responsáveis existentes, aprovar revisão por gestor/CEO, preparar, editar cláusulas/partes/vigência e anexos, encaminhar ao Jurídico, decidir, gerar link, simular OTP para destinatário canônico, aceitar, conferir Financeiro e abrir assinatura por contatos/ForSign sem efeitos reais. Repetir negados/deny/workspace estrangeiro/inativo, alterar materialmente após aceite, confirmar bloqueio dos dois envios e preservação de evidências históricas. Repetir venda histórica e variantes de fornecedores/profissionais antes da CI/publicação.

Próximo passo recomendado: união e revisão independente destes arquivos, resolver as lacunas acima em ambiente isolado antes de aplicar ou publicar; pacote 4 permanece fora do escopo.