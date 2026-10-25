# Ordem 4 — TechSales e integrações

Status: CONCLUÍDA. Código principal publicado, políticas e atribuições aplicadas e aceites de produção realizados em 25/10/2026. O complemento 0225 corrige a identificação das chaves compostas sem mudar as permissões dos registros relacionados.

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

O usuário indicou Guilherme Kologeski (guilherme@wktechnology.com.br) para as quatro subscriptions ativas de admissão/desligamento sem responsável. A migração 0224 altera somente execution_user_id desses quatro IDs no workspace WK, após confirmar membership ativo. Mantém created_by histórico nulo e não concede permissões. A atribuição foi aplicada em produção e as quatro autorizações de execução foram verificadas, preservando created_by nulo.

## Evidência local atual

- 282 verificações reais com GoTrue/PostgREST/HTTP/realtime: CRM 51, API 21, propostas 26, workers/OAuth 53, periféricos 66, execução/aprovações/exportação/pontuação/SLA 54, HTTP/realtime 11. Somente dados fictícios, sem envios reais.
- 1.761 testes de código; TypeScript e lint aprovados. verify completo: source_hash 34cdaa430c37be1f6c8038e4a088208d3f6fe3630cd07cc3b8f903cfa920148a, 88.1 segundos.
- Migrações 0222–0226 ensaiadas integralmente em banco descartável, inclusive com papel postgres sem superusuário e privilégios equivalentes aos hospedados, com ROLLBACK; nunca replay do histórico.
- Aceite visual local: bloqueio de URL sem permissão, propostas/cotações de leitura, negócio sem edição, marketplace negado, workflow de leitura e decisão de aprovação sem administração. Fixtures e overrides restaurados.
- Rollout principal confirmado nos dois domínios com código fa04eb7c9444be341b8ba133a4b23b3404c36347. Journal: 0222/id354, 0223/id355, 0224/id388 e 0225/id389 e 0226/id390. O identificador final do pacote é o mesmo registrado no gate local e no build-info dos domínios após sincronização final.

## Aceite de produção

- Migrações 0222–0226 aplicadas e registradas com os hashes dos arquivos. A tentativa 0224 que retornou indisponibilidade foi conferida no journal e em pg_stat_activity antes de nova tentativa; não foi repetida às cegas.
- Mesmas contagens nas 120 tabelas acompanhadas; hashes de defaults, overrides, cargos e memberships preservados. A alteração operacional é somente execution_user_id das quatro assinaturas WK aprovadas.
- 116 tabelas com RLS habilitada. Leituras anônimas bloqueadas nas 116, tanto no teste SQL como no teste HTTP com chave publicável e sem sessão; nenhum dado exposto.
- Tokens de contato/cotação e credenciais de e-mail/agenda inacessíveis ao papel autenticado comum; dispatcher de worker indisponível a anônimos e sessões comuns; escrita direta em fila e auditoria de pontos bloqueada.
- Os quatro responsáveis das assinaturas estão ativos e autorizados pelos direitos atuais. Lia publicada tem publicador ativo; os cinco workflows ativos mantêm autores humanos válidos.
- Interface de produção conferida com Guilherme no workspace WK: quatro assinaturas e cinco workflows carregam com controles correspondentes. Nenhuma automação real, campanha, e-mail, WhatsApp, convite ou pagamento foi disparado como teste.
- Tabelas de vínculo sem UUID próprio (deal_contacts, proposal_template_services e segment_members) usam os registros pais para autorização e negam consultas de capacidade por UUID sem erro de coluna inexistente.

A documentação e o relatório local preservam os resultados dos gates, das consultas de reconciliação e do aceite visual. A identificação de build dos dois domínios é a prova de publicação; o botão Publicar por si só não é evidência.

Exceções: links públicos usam token de capacidade validado, prazo/status e operações finitas; APIs pessoais usam proprietário e workspace ativo; observabilidade de plataforma requer platform_admins; schedulers exigem segredo técnico e autorização atual dos responsáveis. Testes locais não exercitam comunicações reais ou credenciais de provedores.


## Revisão de performance da RLS

A migração 0226 projeta somente as chaves de recurso utilizadas por cada política
simples da Ordem 4. Mantém exatamente o ator, workspace, equipe, modo de leitura,
permissões efetivas e negações; não altera as políticas restritivas legadas nem os
helpers que precisam das fontes completas (resumos/aprovações).

Com 20 mil contatos sintéticos e a RLS autenticada ativa, a contagem excedia o
limite de 8 segundos e passou a 564,311 ms. O carregamento da fixture é isolado,
com rollback; triggers normais são restaurados antes da medição. Em produção,
a mesma família de consulta, sob o papel autenticado de Guilherme, contou os
51.150 contatos permitidos em 2.506,1 ms. Os resultados não representam um ganho
uniforme em todas as telas. Foram repetidas as sete suítes de autorização,
incluindo realtime; 282 verificações aprovadas. Build final em 124.0 segundos,
com o mesmo identificador do verify e limites de performance aprovados.
