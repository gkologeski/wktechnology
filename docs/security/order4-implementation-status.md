# Ordem 4 — TechSales e integrações

Status: implementação e aceite isolado concluídos; aguardando build final, implantação e aceite de produção. NÃO aplicada nem publicada em produção.

## Escopo entregue no código

- 116 tabelas/catalogações: CRUD, ações especiais, tabelas filhas e histórico polimórfico. Workspace selecionado, membership ativo, responsabilidade atual, own/team/workspace, deny e View As são verificados no servidor e no banco. Nenhuma concessão automática a cargos ou outros workspaces.
- O mapa de 528 operações do servidor documenta gates por ação, RLS do chamador e exceções públicas/pessoais/de plataforma. O número mede cobertura do inventário; o aceite executável é feito por famílias de controle, não 528 testes ponta a ponta individuais.
- API v1 usa papel NOLOGIN/NOBYPASSRLS, intersectando chave e direitos atuais do dono. Campos privados saem das projeções, permissões de coluna e realtime. Escrita sem linha afetada não retorna sucesso.
- Propostas: revisor explícito, versão/hash do servidor, sem autoaprovação/replay; compartilhar e enviar são ações próprias. Cotações possuem prévia interna sem publicação implícita. Itens, associações, atribuições e timelines usam a capacidade do registro real.
- Workers/cadências, SDR/Lia, campanhas, HubSpot, Gmail/agenda, enriquecimento e rodízio da Inbox revalidam responsáveis, configuração, destinatários e direitos atuais antes dos efeitos. A resposta ao cliente permanece independente de quotas comerciais. Campanhas de voz capturam quem as iniciou; campanhas legadas paradas não recebem responsável arbitrário.
- Workflows capturam o publicador como responsável de execução; preservam o autor histórico. Retomadas e efeitos verificam a versão. Fila técnica não aceita comandos/snapshots diretos do navegador. O teste simulado grava histórico real sem executar ações. Criar lead não cria empresa/contato implicitamente: usar ações explícitas com direitos em cada destino.
- Aprovações têm permissões próprias, aprovador indicado, acesso atual à origem e à versão. Decisão/retomada são atômicas, inclusive sob concorrência. O aprovador pode acessar a aba sem receber administração de workflows. Corrigidos os estados permitidos no histórico e o formulário de comentário/decisão.
- Pontuação automática grava os pontos e seu histórico numa transação, sem duplicação concorrente; exige gestão da regra e edição do registro pelo responsável atual. Histórico de etapas/SLA e atribuição exigem acesso às respectivas origens; políticas de SLA possuem ações próprias.
- Exportações agendadas consultam apenas dados autorizados do responsável e revalidam exportação dos registros, configuração e conta de envio. Não deixam CSVs sem escopo no Storage. O bucket de exportações já é privado e estava vazio; a ativação recusa arquivos legados ou bucket público, e o motor não cria arquivos persistentes. Não altera políticas de Storage pertencentes à plataforma.
- Marketplace exige ações reais sobre instalação e devolve configuração sanitizada. Testes indisponíveis são informados como indisponíveis, sem sucesso fictício.
- Conta Azul: importação por workspace exige gestão da integração e leitura/criação/edição financeira no escopo workspace dos recursos envolvidos. Não transforma direito de configurar conexão em direito de importar dados financeiros. Revalida OAuth, páginas e lotes; não inicia pagamentos.
- Resumos de IA novos preservam referências às fontes. Os 252 resumos legados, sem proveniência verificável, exigem leitura integral atual das famílias de origem até serem regenerados. Notificações novas verificam também a leitura do destinatário.

## Responsável das automações legadas WK

O usuário indicou Guilherme Kologeski (guilherme@wktechnology.com.br) para as quatro subscriptions ativas de admissão/desligamento sem responsável. A migração 0224 altera somente execution_user_id desses quatro IDs no workspace WK, após confirmar membership ativo. Mantém created_by histórico nulo e não concede permissões. A atribuição ainda não foi aplicada em produção.

## Evidência local atual

- 276 verificações reais com GoTrue/PostgREST/HTTP/realtime: CRM 51, API 21, propostas 26, workers/OAuth 53, periféricos 66, execução/aprovações/exportação/pontuação/SLA 48, HTTP/realtime 11. Somente dados fictícios, sem envios reais.
- 1.761 testes de código; TypeScript e lint aprovados. verify completo: source_hash b15b7466fdc5b2de64d9a0b62619e393ff6abe57a23e22c37e6aa9ffb91319a3, 97.6 segundos.
- Migrações 0222–0224 ensaiadas integralmente em banco descartável, inclusive com papel postgres sem superusuário e privilégios equivalentes aos hospedados, com ROLLBACK; nunca replay do histórico.
- Aceite visual local: bloqueio de URL sem permissão, propostas/cotações de leitura, negócio sem edição, marketplace negado, workflow de leitura e decisão de aprovação sem administração. Fixtures e overrides restaurados.
- Última produção confirmada: 225c0533537bb186ed22b07715241eb36c5ec602, journal 0221. Publicação desta Ordem ainda NÃO confirmada.

## Passos restantes de implantação

1. Build e perf:check APROVADOS no mesmo source_hash do verify (build 118,5 s).
2. Snapshot e confirmação de preservação de defaults/overrides e dados; conferir journal e revisão remota.
3. Commit e sincronização; aplicar somente 0222, publicar código compatível, ativar 0223 e a atribuição WK 0224.
4. Validar journal, ambos os domínios e UI de produção; só então registrar a Ordem 4 como concluída/publicada.

Exceções: links públicos usam token de capacidade validado, prazo/status e operações finitas; APIs pessoais usam proprietário e workspace ativo; observabilidade de plataforma requer platform_admins; schedulers exigem segredo técnico e autorização atual dos responsáveis. Testes locais não exercitam comunicações reais ou credenciais de provedores.
