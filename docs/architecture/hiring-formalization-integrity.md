> Registro histórico de revisão. As migrações 0375–0380 foram consolidadas no journal; estado final e evidências em `hiring-package3-release.md`.

# INTEGRIDADE-FORMALIZA — correções de 7d65e33ab

Porte G, estimativa inicial 4–6 h. **Preparado e testado localmente; não aplicado/publicado.**

## Escopo e correções

1. Migração aditiva revisável **0379** cria trilha privada imutável dos motivos de submit/legal/finance/reject e ajustes externos. Projeção e RLS exigem solicitação view + formalização manage/approve pertinente + reference.view + contrato view. Ator/data/ciclo/etapa persistidos; eventos básicos permanecem sem notas. Ajustes exigem motivo SQL após OTP válido; inválido não registra decisão/nota.
2. Jurídico nomeado pode revisar compra preparada por ele. Autor da demanda e solicitante da aprovação continuam impedidos; confirmação explícita permanece obrigatória.
3. Repreparo e edição direta do corpo de contrato/minuta bloqueados para envio nativo/ForSign pendente e documento concluído. Cancelamento e revogação liberam somente versão pendente; concluídos preservam histórico e exigem instrumento/aditivo apropriado.
4. Contexto/razão reconhecem assinatura nativa selada, hash atual e TODOS signatários/participantes/testemunhas completos, ou ForSign com manifesto completo, operação privada e PDF/hash armazenados. Estados assinatura pendente/assinado; assinado aguarda autorização de início. Sem ativação/serviço/financeiro/pacote 4.
5. Cartão da nova origem elimina associação comercial/recrutamento e atestado manual externo. Prévia jurídica separada do gate de envio; gate nativo também executado antes da geração. ForSign conserva rechecagens reais anteriores a efeitos. Nenhuma mudança nos cálculos ou hashes históricos.
6. Compra WK esconde seletor de cotação/proposta de venda e recomenda proposta do fornecedor/condições WK como arquivo PDF. RPC link e submit informam erro específico. Anexos existentes continuam consultáveis via controles originais/preview, mas vínculo comercial de venda não serve como anexo da nova compra na publicação. Aceite usa mesma versão/hash; sem conversão silenciosa.

## Arquivos

Criados: `drizzle/migrations/0379_hiring_formalization_integrity.sql`, `src/lib/hiring/requests/formalization-presentation.test.ts` e este relatório.

Alterados: `src/lib/hiring/requests/{formalization-types.ts,formalization-panel.tsx,formalization-postgres.test.ts,AGENTS.md}`; `src/lib/hiring/{signature.functions.ts,signature.types.ts}`; `src/components/hiring/contract-signature-card.tsx`; `src/components/contracts/{contract-attachments-card.tsx,signature-attachments-summary.tsx,signature-attachments-summary.test.ts}`; `src/lib/contracts/attachments.functions.ts`; `src/lib/integrations/forsign/forsign-authorization.test.ts`; `tests/fixtures/hiring-formalization.sql`; os dois guias people/contracts v6→7 e catálogo oficial; permission-contracts.json; roadmap.md. Nenhum removido.

0375, 0376–0378, tipos gerados, baseline e journal não alterados. Helper da branch local ee79d42a0 não substituído. Nenhuma concessão a cargos, aplicação de SQL/Ajuda ou publicação.

## Validações executadas

- `bun run permissions:check`: nenhum finding do lote; falha global pelos dois findings legados de types.ts (preservados para união).
- `bunx vitest run src/lib/hiring/requests/formalization-postgres.test.ts src/lib/hiring/requests/formalization-presentation.test.ts src/lib/hiring/requests/draft-code.test.ts src/components/contracts/signature-attachments-summary.test.ts src/lib/integrations/forsign/forsign-authorization.test.ts src/lib/integrations/forsign/forsign-core.test.ts src/lib/contracts/signature-package-pdf.test.ts`: **77/77**, sete arquivos; **30 SQL reais** em PostgreSQL descartável.
- Ensaio agora carrega funções REAIS `contract_esign_manage`, `hiring_signature_access`, `hiring_contract_signers_prepare`, `hiring_contract_native_prepare`, `contract_esign_public`, `esign_check_completion`, `forsign_record_evidence`, fingerprint e contextos de anexos. Preparou três participantes, enviou no banco descartável e assinou por RPC público só fixtures; testemunha incompleta não conclui, completa conclui; manifesto faltante reabre pendência. ForSign recusa roster incompleto e só reconhece PDF/hash privado de operação corrente.
- Variantes supplier com Jurídico preparador, CLT/PJ/freelance; notas persistidas/escapadas, sem chave/deny/workspace/inativo/contrato/formalização negados; motivos externos inválidos não registrados; proteção de corpo pendente/concluído; cancelamento+revogação preservam documento anterior; regressão reason/context de vendas idênticos.
- PDF suite verifica anexos e hash dos bytes; apresentação verifica escapa notas e prévia autorizada sem gerenciamento/Financeiro. Teste servidor ForSign confirma gate bloqueia antes de storage/provedor.
- ESLint direcionado: **0 erros, 9 avisos** (tamanho de arquivos e any preexistentes no teste ForSign). Prettier direcionado executado. `git diff --check` passou.
- `bun run help:coverage`: **254/254**; catálogo 436 artigos; somente dois guias atualizados, não aplicados.
- Build automático observado: **build OK**. Não rodados tipos/build manualmente nem verify integral. `verify:changed --dry-run` somente planejamento, não aprovação do loop.
- Playwright localhost: timeout antes do DOM; tela autenticada real não validada. Testes DOM/jsdom passaram; não equivalem ao aceite visual completo.

## Segurança, riscos e pendências

SQL executado é real, mas dependências de autorização/cadastros continuam fixture reduzida, não schema total de produção. Nenhuma alegação de integração total. API ForSign/rede/OTP/convites reais não acionados; status remoto é coberto por adaptador e roster SQL, não chamada à conta real. Prévia integral e congelamento são testados no montador PDF e hash SQL, não download autenticado hospedado. Prévia sem anexos gera PDF privado separado, nunca pacote canônico vazio. Nenhum token/código/valor/notas adicionado a eventos básicos/listas/logs.

Pendente: união com ee79d42a0, preflight do schema real com rollback informado pelo usuário, CI integral e teste visual autenticado após aplicação isolada autorizada. Não aplicar/publicar antes dessas verificações. Não implementado: execução e pacote 4.

## Como validar na união

Aplicar 0379 somente em ambiente descartável após 0376–0378, com versão local do lote 1. Executar suíte acima e preflight completo. Conferir fornecedor preparado/revisado por Jurídico diferente do autor da demanda, prévia antes do Financeiro, motivos privados com perda de cada permissão, assinatura com testemunha pendente/completa, rejeição externa com/sem motivo, rejeição com OTP inválido, cancelamento/revogação e tentativa de limpar corpo concluído. Abrir venda histórica e confirmar seletor/razões inalterados. Depois CI e revisão independente, sem iniciar pacote 4.