# INBOX-CENTRAL — SQL/runtime do pacote 2

## Status e escopo

Porte G, previsão inicial 4–6 horas. **Parcial: código executável aplicado somente neste draft, com provas reais específicas; cadeia integral e gates finais ainda não certificados.** Lock 0409 e `INBOX_CHANNEL_RUNTIME_READY=false` mantidos. Nenhum aceite, publicação, SQL em produção ou transporte para provedores.

O lote é SQL/runtime. UI, edição/publicação editorial da Ajuda e produtores de transições ficam fora deste lote, conforme pedido explícito. Isso não dispensa os gates antes da entrega integral.

## Implementado e efetivamente exercitado

- `gmail_sync_finish` concilia mensagem inbound incremental, conta/thread/workspace corretos, descoberta imutável, timestamp do provedor, hash de envelope e corpo, evidência e ocorrência antes de `done`. Retry depois de persistir, com outcome `existing`, cria exatamente uma evidência/ocorrência. Não transforma descoberta preexisting/seed/expired_history em live.
- Parser Gmail rejeita ausência/invalidez de `internalDate`; não substitui por `Date.now()`.
- Conversa Gmail usa RLS real de `email_threads` sob o papel autenticado, incluindo `sales_view` e política restritiva, separadamente da conexão da conta. Atendente atribuído com Inbox.view.own e sem configuração lê thread e referência e abre a notificação. Sem chave, deny, outro workspace e inativo não leem. Nenhuma configuração ou catálogo WF foi concedido.
- Seam real de INSERT de notificação preenche `/inbox/email?conversation=<uuid>` e um contexto de origem. Desconectar a conta revoga sua abertura. Ser owner não mantém own-scope depois da atribuição a outra pessoa.

## Código adicional aplicado, mas sem aceite positivo integral

- `notification_business_proof_current`: Inbox valida a mensagem/recibo privados reais Gmail/widget/Unipile, proveniência, data, escopo e hashes. Transições sem produtor atestado permanecem negadas.
- Cadeia de eventos: hash por nó, raiz, referência, revisão, pai imediato, cursor, workflow/versão, ciclo/limite, cutoff de ocorrência e recebimento, conta, configuração e executor atuais.
- Worker: cap original antes de consumir refs, aliases conflitantes rejeitados, ref especial estritamente de leitura, UUID validado, configuração atual novamente conferida.
- Referências Inbox passam por RLS invoker; consultas anteriores foram enumeradas estaticamente, sem SQL dinâmico. Branch canônico da prova WhatsApp foi preservado; demais eventos delegam à fundação anterior.
- Guard de configuração passa a executar também nas mudanças enabled/status/published_version/execution_user_id.
- Reuso consulta responsável atual, acesso atual e aviso não lido; lock transacional por conversa/destinatário e consulta também avisos workflow anteriores da mesma conversa. **Ainda não há prova de concorrência entre todos os produtores legados.**
- INSERT de intenção externa preenche o href e revalida prova/destinatário. Atualização depois de terminar o run não exige que ele ainda esteja running; INSERT inicial exige. Worker write seam cobre os estados reais queued/in_flight/retry_scheduled. **Esse trigger não substitui o preflight existente**, que já chama business_run_key/event_check.
- Dispatches principais preservados byte a byte; alterações são seams executáveis de gravação/reuso. O resolvedor agendado anterior continua com seus filtros atuais; sua revalidação/contagens ainda precisam de aceite próprio.

## Arquivos

Criados: `src/lib/gmail-provider-time.ts`, `src/lib/gmail-provider-time.test.ts`, `tests/fixtures/inbox/central.sql`, `scripts/isolated-db/inbox-central-local.ts`, este relatório e migrations nativas 0422–0431 com snapshots.

Alterados: `src/lib/gmail-sync.server.ts`, `roadmap.md`, journal nativo e tipos Supabase regenerados exclusivamente pela ferramenta nativa. Removidos: nenhum. `db/seed.sql`, UI, Ajuda, contratos de autorização e baseline não alterados neste lote.

## Revisão, problemas e correções

- Primeira proposta foi recusada por SQL dinâmico; nada daquela tentativa foi aplicado. Reenvio separou a referência estática e usou SQL legível/record.
- Teste real revelou que `techerp_api_subject` não recebe as policies destinadas a authenticated. Criados avaliadores privados sob authenticated, sem conceder herança de papel nem USAGE/CREATE persistente no esquema privado.
- Cadeia interna também faltava EXECUTE de membership/leave ao papel técnico. Grants técnicos privados foram adicionados; não são grants de negócio. **Esses dois ACLs auxiliares mudaram explicitamente**; não afirmar que todos os ACLs do catálogo ficaram idênticos.
- Tentativa de USAGE no esquema auth não resolveu o caminho da central; o caminho final não depende dela, e 0431 a revoga. Avaliador privado autenticado confere identidade/workspace e RLS.
- Revisão independente identificou UPDATE de intenção após run concluído e estados fictícios do worker; corrigidos incrementalmente em 0427/0428.
- Erros de formatação corrigidos. ESLint dirigido final: 0 erros, 3 avisos (dois `any` no script descartável e tamanho do módulo Gmail).

## Validações reais

- `bunx vitest run src/lib/gmail-provider-time.test.ts src/lib/gmail-sync-queue.test.ts`: 16/16.
- `bun scripts/isolated-db/inbox-central-local.ts --disposable-draft`: 11 verificações, GoTrue login real e PostgREST, sem JWT fabricado/SET ROLE. Cinco perfis, Gmail existing-on-retry, href/contexto/central, desconexão e reassignment. **Notificação é criada diretamente no seam de INSERT para isolar leitura/gravação; não equivale a dispatch publicado.**
- `bun scripts/isolated-db/gmail-queue-local.ts --disposable-draft`: 29/29.
- `bun scripts/isolated-db/inbox-producers-local.ts --disposable-draft`: 9/9.
- `bun scripts/isolated-db/inbox-review-local.ts --disposable-draft`: 6/6.
- Consulta real: dez OIDs canônicos mantidos (19560/19562/20484/20394/20027/39741/39742/39722/20498/20407). Owners/ACL dos sete controles centrais conferidos conforme catálogo original. **Não houve captura completa de todas as dependências antes/depois nem prova funcional de todas as entidades antigas/WhatsApp.**
- `bun run permissions:check`: falhou com 46 findings; nenhum contrato foi declarado completo sem evidência e o baseline não foi regenerado.
- Compilação automática observada `build OK`; verify/CI/perf integrais não executados. Não houve build ou typecheck manual. Playwright não executado neste lote SQL/runtime.

## Segurança, dados e acessibilidade

Fixtures são explícitos, locais e restritos pelo preflight descartável. Usuários obtêm sessões do GoTrue local; senhas aleatórias ficam apenas na memória do teste, sem logs/seed. E-mail do proprietário não utilizado. Nada é enviado a clientes/provedores. Consentimentos, políticas de transporte e limites existentes não modificados. UI/acessibilidade: não aplicável a este lote sem alterações visuais.

## Pendências reais — continuar, não considerar concluído

1. Aceite positivo PostgreSQL/PostgREST das três vias de dispatch com contagens exatas, reuso legado/concorrência e resolução agendada com prova atual.
2. Executar matriz de root/child/hash/revision/cutoff/executor/readonly/campos/referências e reativação/republicação/retomadas, incluindo os cinco JWT no próprio dispatch; a matriz já executada cobre conversa/central, não essas operações.
3. Completar revalidação do resolvedor agendado e fechar concorrência com produtores legados, preservando contagens/consentimentos/limites.
4. Comprovar equivalência funcional e dependências de todas as fontes antigas e WhatsApp; endurecer aliases de ações/campos conforme esse aceite.
5. Fechar contratos com evidência suficiente e resolver gate integral, regressões anteriores e CI. Depois, lotes UI/Ajuda/transições.

Nenhuma pendência acima é transformada em aceite fictício. Lock intacto; nenhuma exceção de teste para ativar workflow multicanal foi adicionada. Os dados de teste do draft não vão ao app se ele for aceito.

## Validação manual e próximo passo

Executar o script somente com `--disposable-draft` e identidade local exigida, conferir href/contexto e recusa dos cinco perfis. Próximo lote deve completar a prova/execução dos dispatches e retomadas no harness descartável, sem retirar o lock de liberação deste draft. Não aceitar ou publicar o estado atual.
