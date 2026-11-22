# INBOX-PRODUTORES — revisão parcial, não liberada

Atualização INBOX-RESPOSTA: a falha Gmail abaixo foi reproduzida e diagnosticada
como falta de `email.create.own` na fixture do remetente, sem alterar a regra.
Fixture explícita corrigida; 87 verificações Gmail passaram, incluindo cadeia
original, abertura/histórico/segunda resposta/espelhos/incerto. 0442–0444 somente
draft corrigem chat/RLS e elegibilidade; ver inbox-response-review-2026-11-22.md.
O restante desta revisão permanece histórico e a certificação integral pendente.

Porte G, previsão informada de 4–6 horas. Escopo SQL/runtime; UI e Ajuda reservadas ao Codex. Nenhuma publicação, aceite, ativação ou SQL em produção.

## Preparado e aplicado somente neste draft

- 0439: criação Gmail atestada no INSERT de conversa nova, vinculada à fila incremental reservada. Campo imutável; finish existing reconcilia o mesmo recebimento e criação. Threads anteriores, outbound, seed e histórico não adquirem a atestação.
- 0439: provas de transição verificam recibo, hash, ator ativo, conversa atual, conta, autorização e valor atual da atribuição/status.
- 0440: reservas Gmail append-only e recibos privados aceitos; registro de pedido e imutabilidade de transporte Unipile após sent; reconciliação da projeção ligada ao recibo, não a direction/status.
- 0441: verificador comum acrescenta criação Gmail e checa origem canônica atual das respostas. Notification business proof/worker existentes continuam delegando a esse verificador; não foram substituídos nem concedem bypass.
- Gmail humano utiliza reserva antes do transporte e recibo antes da projeção. Retry explícito com a mesma chave não envia novamente. Sem request_id, a chave conservadora deriva do conteúdo, conta e ator: mensagens idênticas são deduplicadas; um envio deliberadamente novo precisa de nova chave. Nenhuma UI foi alterada para expor isso.
- Gmail SDR persiste aceite privado antes da conclusão do job; retomada pode recuperar o provider_id desse recibo sem reenviar. Sequências Gmail são capturadas a partir do recibo privado já persistido pelo efeito canônico.
- Todos os envios LinkedIn que usam o cliente central (Inbox, SDR, sequências comerciais, sourcing ATS e outreach humano) registram o pedido antes do transporte, mantendo reserva, quota, janela e resultado incerto. Aceite/retry tentam reconciliar o histórico sem converter falha de notificação em envio novamente.

## Resultados realmente executados

| Comando                                                                                                                                                                                                                                                                          | Resultado                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `bun scripts/isolated-db/inbox-guard-local.ts --disposable-draft`                                                                                                                                                                                                                | 60 checks GoTrue/PostgREST do guard + 9 checks chat passaram                                                           |
| `bunx vitest run src/lib/inbox-transport.test.ts src/lib/unipile/client-delivery.test.ts src/lib/prospecting/sdr/service-worker.test.ts src/lib/gmail-sync-queue.test.ts src/lib/prospecting/sequences/delivery.test.ts src/lib/prospecting/sequences/transport-timeout.test.ts` | 62 testes passaram                                                                                                     |
| `bun scripts/isolated-db/inbox-gmail-transport-local.ts --disposable-draft`                                                                                                                                                                                                      | **Falhou**: primeira resposta Gmail teve 0 ocorrências, esperado 1; criação e recebimento anteriores foram persistidos |
| ESLint dirigido aos arquivos TS deste lote                                                                                                                                                                                                                                       | 0 erros, 37 avisos (principalmente tamanho/any preexistentes)                                                          |
| `bun run permissions:check`                                                                                                                                                                                                                                                      | Falhou; nenhum contrato novo foi declarado completo e baseline não foi regenerado                                      |
| Compilação automática                                                                                                                                                                                                                                                            | Último sinal consultado: build OK                                                                                      |

O teste Gmail foi repetido após definir o workspace ativo do ator; a falha de primeira resposta permaneceu. A asserção não foi relaxada. A suíte portátil PostgreSQL/PostgREST recebe um cliente da cópia descartável e usa callback de transporte de teste: não envia ao Google. Não há alegação de aprovação de CI ou de transporte externo real.

## Revisão e limites abertos

1. **Falha concreta:** recibo Gmail aceito e projeção persistida, mas emissão da primeira resposta não gerou a ocorrência positiva no teste real. Diagnóstico/correção permanecem obrigatórios antes de qualquer liberação.
2. **Não certificado:** 13 chaves completas, atores/workspaces/deny/inatividade no próprio worker para cada chave; respostas positivas Gmail humano/SDR/sequências e Unipile por todos os consumidores; provas atuais de todas as transições; retomadas com configuração revogada.
3. A leitura da conversa Gmail retornada pelo transporte acontece antes da gravação do aceite. Se essa leitura falhar após o envio, a reserva impede reenvio automático, mas o aceite precisa de reconciliação adicional. Não tratar essa lacuna como confirmação durável integral.
4. Unipile sem chat_id explícito ou sem conversa já existente conserva o recibo do transporte, mas não infere/hidrata identidade para criar uma primeira resposta. A reconciliação dessa variante ainda precisa de prova positiva.
5. Evidências informadas pelo Codex (21 execução, cinco isolamento, 28 origens × cinco perfis) são evidências externas recebidas, não execuções deste turno; não cobrem automaticamente estes novos produtores.
6. O novo teste compartilhado precisa ser conectado à preparação CI completa com as relações/caminhos canônicos; não foi alegado como suíte CI integral já executada.

## Arquivos e fronteiras

Criados: migrations 0439–0441 e snapshots nativos; `src/lib/inbox-transport.server.ts`, `src/lib/inbox-transport.test.ts`, `tests/fixtures/inbox/gmail-transport-checks.ts`, `scripts/isolated-db/inbox-gmail-transport-local.ts`, este relatório.

Alterados: Gmail sync e envio humano, cliente central Unipile, transportes/retomadas SDR, testes Unipile, roadmap, journal e tipos regenerados pela ferramenta. Removidos: nenhum.

Sem novos GRANTs, sem mudança de baseline/consentimento/limites/UI/Ajuda. CREATE OR REPLACE mantém as assinaturas antigas; OIDs/ACL/dependências de todas as fronteiras ainda exigem comparação formal completa. Lock continua obrigatório; não há certificação global.

## Validação seguinte, sem liberação

Corrigir primeiro a falha positiva Gmail pelo mesmo teste sem enfraquecer controles; depois conectar a prova positiva dos demais consumidores à CI portátil e executar os cinco perfis para cada chave. Somente controles completos e cenários reais permitem fechar contratos. Nenhum passo deve remover o lock do draft.
