# Roadmap — Importação do ClickUp para o TechProjects (porte G)

- [x] Leitura completa do ClickUp (11 workspaces, 16.477 tarefas) e proposta de organização
- [x] Chave do ClickUp removida do campo "lista padrão"
- [x] Projetos repetidos unificados (OS - Citel, OS - Quantity, OS - IXC, OS - InForma) e empresa "In Forma" unificada em "InForma", com cópia para desfazer
- [x] "In Forma Software" do CRM unificada como "InForma" e "Outsourcing -> InForma" juntado em "OS - InForma"
- [x] Tabelas de preparação/vínculo e motor de importação (Dailys como tarefas, Byteway como projeto novo de Consultoria, sem workspaces de teste)
- [x] Tela de revisão, vínculo de responsáveis com TechPeople e "Desfazer importação"
- [x] Permissões novas e testes (permitido, sem chave, negado, outro workspace, inativo)
- [x] Importação aplicada: 16.474 tarefas, 12 projetos e 3 espaços novos (desfazer testado sem efeito real)
- [x] 3 responsáveis do ClickUp cadastrados sem acesso (Adauto Lucas, Eduardo Gonçalves, Thiago Mandrik) e ligados às 84 tarefas
- [x] Ficha do projeto carrega 50 tarefas por coluna com "Carregar mais"; lista de Tarefas paginada e rápida
- [x] Checagem de permissões sem pendências
- [ ] Publicação (aguarda aceite do usuário)

# Roadmap — Reorganização da tela /agents/sdr (porte G, em pacotes)

- [x] Pacote 1: 9 abas viram 3 áreas (Operação, Estúdio, Resultados) com seções, endereço por `?section=`, cabeçalho padrão e "Novo agente" levando ao Playbook (com permissão de criar)
- [x] Pacote 2: Estúdio integrado — barra única do agente aberto (endereço `?agent=`), conversa de teste fixa à direita em todas as seções do Estúdio, Playbook segue o agente aberto
- [x] Botão "Duplicar agente": copia playbook, configuração, ferramentas e persona (como rascunho); cópia desativada, sem número de WhatsApp e não principal
- [x] Duplicação testada de verdade: cópia idêntica (playbook e persona em rascunho), desativada, não principal; cópia de teste apagada em seguida
- [x] Pacote 3: Operação com indicadores (Para revisar, Falhas, Em conversa, Com humano) e "Em atendimento" com nomes, agente, situação/etapa em português, filtros por situação e atalho para a conversa
- [x] Pacote 4: Resultados com totais contados no banco (antes truncados em 500), funil, reuniões reais com anfitrião/horário, reuniões aguardando ação e qualificações
- [x] Conferência no celular e no modo escuro (corrigida rolagem lateral das tabelas no celular)
- [ ] Publicação (aguarda aceite do usuário)

# Roadmap — Lia obedece à persona publicada (refatoração SDR)

- [x] Prompt em seções: contrato técnico, precedência, persona publicada na íntegra, controles, complemento, contexto verificável
- [x] Remover regras fixas, respostas fixas e reescritas editoriais (worker, persona, guards, terceiros)
- [x] Estado explícito da conversa com CAS no commit (0184) + prova isolada com corrida
- [x] Descadastro só explícito; recusa comercial encerra sem bloqueio permanente
- [x] Agenda: até 3 novas opções após recusa (configurável), e-mail escrito pelo cliente
- [x] Automação "pergunta sobre IA" opcional e desligada
- [x] Pipeline único produção/teste com trace; teste com rascunho ou publicada
- [x] Testes com saídas programadas + verify/build + Playwright no estúdio
- [ ] Comparação A/B com IA real além de poucas mensagens no teste (custo/escopo; aguarda decisão do usuário)
- [ ] Publicação do código (aguarda aceite do usuário)

# Roadmap — TechProjects Ciclo 6 (itens 14–15)

- [x] Banco 0179: API sob RLS do dono da chave (papel sem login), idempotência, limite por chave, fila offline idempotente, competência fechada na criação, painel de operação, higiene de privilégios
- [x] Provas: SQL isolada C6 + concorrência; HTTP com GoTrue/PostgREST reais; regressões C1–C5
- [x] Servidor: rotas v1 (projetos, tarefas, apontamentos, OpenAPI), saúde/prontidão, webhooks com guarda SSRF/assinatura/sem redirecionamento, assistente somente leitura
- [x] Telas: fila offline (Minhas Horas + janela de apontamento), assistente no painel, Operação e saúde
- [x] Fluxo integrado não admin (negócio→…→painel) em banco isolado
- [x] Desempenho: 1 milhão de apontamentos / 100 sessões em banco isolado (0180/0181); visão de equipe sob carga mista ainda acima da meta
- [x] Ensaio de backup/restauração em banco descartável + runbook
- [x] Playwright (claro/escuro/celular/teclado/offline), verify e build completos
- [x] Documentação, AGENTS e relatório unificado C1–C6
- [ ] Visão "Equipe" do admin com 1 milhão de apontamentos e 100 sessões mistas: p95 ~9,8 s (meta 2 s) — precisa de consumo por projeto pré-calculado (decisão de arquitetura)
- [ ] Teste no navegador com usuário comum real e chave de API real (só provado em banco isolado; nenhuma conta/chave real criada)
- [ ] Backup gerenciado: conferir no painel o horário do último backup; PITR/RPO 1 h/RTO 4 h/99,9% exigem plano e monitor externo (não contratados)
- [ ] Webhook real: aguarda destino autorizado por administrador
- [ ] Publicação (aguarda aceite do usuário)

# Roadmap — TechProjects Ciclo 4 (itens 10–11)

- [x] Banco: tarifas com vigência, modelo de cobrança (dono por serviço/período), medições, saldo de pacote, vínculo com o Financeiro, guardas entre mecanismos, rentabilidade (0175, correção 0176)
- [x] Provas SQL isoladas (99 + concorrência) e regressões C1 (65) / C2 (83) / C3 (116)
- [x] Servidor: funções de tarifas/medições/rentabilidade; geradores antigos respeitam o dono da cobrança; consolidador antigo de horas desativado
- [x] Telas: Tarifas e custos, Medições do contrato, Medições e rentabilidade do projeto, indicadores da ficha do projeto, origem no Financeiro
- [ ] Cadastrar tarifas, modelos de cobrança e conceder permissões do ciclo 4 (decisão do usuário; nada criado automaticamente)
- [ ] Teste com perfil não admin real e medição real (só provado em banco isolado)
- [ ] Publicação (aguarda aceite do usuário)

# Roadmap — TechProjects Ciclo 3 (itens 7–9)

- [x] Banco: política versionada, modelos por serviço, aprovadores/delegação, alocação com vigência/capacidade, apontamento por duração/segundos/fuso, cronômetro com pausas, envio/aprovação versionados, aceite manual, fechamento/reabertura, prévia Jibble sem horário (0173/0174)
- [x] Provas SQL isoladas (116 + concorrência) e regressão C1 (65) / C2 (83)
- [x] Servidor: funções novas e rotas antigas redirecionadas ao fluxo
- [x] Telas: apontamento, Minhas Horas sem 8h presumidas, timesheet, aprovação, ficha do projeto, configurações, conciliação, capacidade na alocação
- [x] WK: modelos dos 6 serviços ativos (sem BPO/sob medida)
- [ ] Reativar o widget do cronômetro no layout (oculto por decisão anterior; aguarda o usuário)
- [ ] Nomear aprovadores nos projetos WK e cadastrar jornadas no TechPeople (decisão do usuário; envios ficam bloqueados até lá)
- [ ] Materializar os 504 candidatos Jibble sem horário (aguarda revisão humana na conciliação)
- [ ] Teste com perfil não admin real e fluxo de envio/aprovação/fechamento com dados reais (só provado em banco isolado)
- [ ] Publicação (aguarda aceite do usuário)

Pendências preservadas: C1 (68 sugestões, divergência Clockify 12 pessoas, 403 em 5 categorias, Jibble não reconciliado); C2 (ganho real e UI não admin não validados; não publicado).
# Roadmap — Cargo e porte derivados (prioridade atual)

- [x] Auditar fontes, gravadores, gatilhos e candidatos agregados
- [x] Implementar catálogo versionado, derivação e precedência no banco (0142/0143)
- [x] Provar INSERT/UPDATE/UPSERT/clear/legado/isolamento/readonly em banco descartável
- [x] Preparar catálogo v2 e classificador corrigidos; provar HRBP/Business Partner, Product Owner, Partner Manager, desenvolvimento de negócios e Diretor Técnico em 92 assertions SQL isoladas
- [x] Confirmar classificador/catalogo v2 ativo; proteções atuais aplicadas em 0144/0145
- [x] Concluir recalculo: 51.144 Contatos, 5.924 Leads, 32.044 Empresas; fontes iguais ao backup linha a linha e por hashes JSON ordenados
- [ ] Comparar hashes independentes (bloqueado: serialização original desconhecida)
- [ ] Remediar datas/espelhos históricos com cadeia auditável; bloqueado por falta de prova de ausência de edições posteriores, não restaurar cegamente
- [x] Integrar fichas, filtros, grids, públicos, exportação e lookup
- [x] Validar testes, lint e sinais completos de compilação; documentar resultados
- [x] Playwright autenticado: lista real e ficha HR Business Partner / Recursos humanos / Especialista
- [ ] Prova isolada REST/JWT completa (não executada nesta continuidade)
- [ ] Publicar app (bloqueado até verificação do usuário)

# Roadmap — Lia: ferramentas e agendamento direto

- [x] Catálogo de habilidades/ferramentas, executor e laço de ferramentas no turno
- [x] Agendamento direto (consulta real, 3 opções, recusa, data específica, reserva com trava, conciliação) e remoção do link /book/
- [x] Aba "Habilidades e ferramentas" + teste simulado + registro
- [x] Rascunho v7 da Lia configurado (anfitrião Guilherme)
- [ ] Publicar v7 da Lia (aguarda revisão do usuário)
- [ ] Agenda Microsoft 365 (sem conexão Microsoft no sistema)
- [ ] Plano multicanal pendente (preservado)

# Roadmap — Correção dos cargos da WK

- [x] Fase 0 — foto do estado atual e reversão (0122)
- [x] Fase 1 — permissões só para membro ativo; cargos só por admin; aprovação de perfis só pelo líder (legado fechado, override admin com motivo); chat ao vivo por permissão e visibilidade (0122 + servidor)
- [ ] Fase 2 — matriz dos 16 cargos (Apontador, perfis de vaga, denies de Visibilidade total, Rep. Externa, Colaborador Externo, Auditor)
- [ ] Fase 3 — tela /settings/permissions com permissão efetiva, origens, dependências e aviso de admin
- [ ] Fase 3b — botão de override administrativo com motivo no quadro de perfis de vaga
- [ ] Fase 4 — provas isoladas dos cargos, aplicação e leitura das permissões efetivas reais
- [ ] Publicação coordenada (decisão humana)

# Roadmap — Ciclo de contratação/desligamento via Workflows

# Roadmap — Três propostas de Agentes de IA

- [x] Estúdio em /agents/prototype/1
- [x] Assistente de criação em /agents/prototype/2
- [x] Central de operação em /agents/prototype/3
- [x] Navegação, wizard, canvas e cliente com estados locais
- [x] Inspeção autenticada, temas, arquétipos e validações direcionadas
- [ ] Escolha/aprovação visual do usuário (sem ativação real)

- [x] Fase 1 — ações de contratação no motor (validada com candidata de teste)
- [x] Fase 2 — diálogo de desfecho de contratação no TechHire (interna/outsourcing/hunting)
- [x] Fase 3 — modelos nativos (Vendedor PJ, Freelancer, Outsourcing, Hunting, Desligamento)
- [x] Fase 4 — desligamento: gatilho Pessoa desligada + encerrar contratos, alocações, acesso e parcelas
- [x] Fase 5 — specs Playwright em tests/e2e + validação real dos cenários

# Roadmap — Papel Representante de Vendas (externa)

- [x] Fase 1 — leitura no banco respeita escopo do cargo (leads, contatos, empresas, negócios, atividades, cotações)
- [x] Fase 2 — leitura vinculada (empresa/contatos ligados aos registros dela)
- [x] Fase 3 — cargo "Representante de Vendas (externa)" só TechSales
- [x] Fase 4 — aviso ao responsável da empresa (notificação); exportação oculta por permissão
- [x] Fase 5 — validação por papel

# Roadmap — Cotação → Proposta → Contrato

- [x] Fase 1 — ligação entre etapas e botões de geração
- [x] Fase 2 — campo Linha de serviço na cotação (seções sugeridas na proposta)
- [ ] Fase 3 — modelos de proposta/contrato por linha
- [x] Fase 4 — itens da cotação viram serviços do contrato
- [ ] Fase 5 — atalho de aditivo para cliente com contrato ativo
- [x] Fase 6 — textos da tela de Propostas
- [ ] Fase 7 — teste real de conversão (aguarda autorização para gravar dados)

# Roadmap — Redesign da Inbox multicanal

- [x] Direção visual aprovada: cockpit multicanal com identidade White Label
- [x] Direção final aprovada: Floating soft panels v3, Sora + Manrope e superfícies fluidas
- [x] Casco compartilhado com canais no topo e painéis amplos para lista, conversa ativa e contexto
- [x] Estados, acessibilidade e responsividade das quatro rotas
- [x] Validação visual e funcional das quatro rotas em desktop, mobile e modo escuro

# Roadmap — Associação de clientes na Inbox

- [x] Resolver remetentes por telefone ou e-mail dentro do workspace
- [x] Priorizar Contato e usar Lead somente quando nenhum Contato corresponder
- [x] Sinalizar duplicidades sem associação automática e permitir escolha manual
- [x] Aplicar em WhatsApp, Email e Chat ao vivo, preservando associações manuais
- [x] Incluir os três canais e nomes de Leads na Inbox unificada
- [x] Atualizar conversas existentes com correspondências inequívocas

# Roadmap — Notificações da Inbox e timeline

- [x] Notificar mensagens recebidas atribuídas em WhatsApp, E-mail e Chat ao vivo
- [x] Atribuição manual e filtros por responsável nos três canais
- [x] Distribuição automática opcional para os três canais
- [x] Rolagem proporcional das laterais nas fichas de Lead, Contato, Empresa, Negócio e Ticket

# Roadmap — Inbox: janela de 24 horas, avisos e layout

- [x] Bloquear envio livre de WhatsApp fora da janela de 24 horas no servidor
- [x] Sugerir e enviar somente templates Meta aprovados fora da janela
- [x] Avisar somente na primeira mensagem não lida e fora da Inbox
- [x] Corrigir cortes com três painéis fluidos em desktop e mobile
- [ ] Validar código, testes e fluxo visual

# Roadmap — Agentes de IA: paridade ChatSuite (docs/agents/chatsuite-parity.md)

- [x] Catálogo único de blocos com editores próprios, saídas, validação e resumo
- [x] Executor de fluxo com trace, validação de grafo e ferramentas simuladas (testado)
- [x] Três protótipos usando o mesmo contrato; chat de teste roda o executor
- [ ] Persistência multiagente com rascunho/publicado e rollback (migração aditiva)
- [ ] Seletores reais do workspace (agendas, equipes, funis, fontes, conexões)
- [ ] Executor ligado ao inbound de produção, métricas por agente/versão/origem
- [ ] Ingestão de conhecimento (upload, trechos, validade) e perguntas sem resposta
- [ ] HTTP no servidor com cofre; integrações externas (dependem de credenciais)
- [ ] Modelos de fluxo, regras de ativação, supervisor/treinador/regressão

# Roadmap — Perfis de vaga no negócio (TechSales → TechHire)

- [x] Banco: perfis, comercial restrito, versões imutáveis, eventos, anexos privados, links do cliente, propostas, encaminhamentos, modelos, importações
- [x] Aba "Vagas e perfis" com assistente em 6 etapas, ficha, histórico, diff, modelos, duplicar
- [x] Aprovação com mínimos, encaminhamento idempotente com autorização antecipada, sincronização explícita
- [x] Link seguro do cliente (somente campos liberados, revisão interna)
- [x] Importação com IA (texto, URL, DOCX, PDF, imagem, conversas do negócio)
- [x] Testes: unitários, banco com rollback, navegador ponta a ponta
- [ ] Liberar as novas permissões para cargos não administradores (decisão do usuário)
- [ ] Apagar 3 arquivos fictícios de teste no armazenamento privado (exige ação de armazenamento)

# Roadmap — Performance ciclo 1

- [x] Sprint 0 — baseline (docs/architecture/performance-baseline.md)
- [x] Tempo real filtrado por registro, agrupado e reconciliado ao reconectar
- [x] Pré-carregamento seletivo (módulo, permissão, rede, sem competir com navegação)
- [x] Cache zerado na troca de workspace/usuário/Ver como/saída
- [x] Janelas de atividade sob demanda
- [x] Cache do lint (medido 55 s → 3 s)
- [ ] Medir telas restantes (dashboard, Inbox, Projetos, Prospecção, TechHire)
- [ ] Comando real da verificação automática (inacessível no sandbox)
- [ ] Backlog do próximo ciclo (docs/architecture/performance-backlog.md)

# Roadmap — Persona e teste do Agente SDR

- [x] Auditar a tela existente e os padrões atuais do TechERP
- [x] Redesenhar identidade, voz, atendimento, ações e versões sem alterar comportamento
- [x] Redesenhar a conversa de teste segura para desktop e mobile
- [x] Validar visualmente em claro/escuro e desktop/mobile
- [x] Executar tipos, lint direcionado e conferir build automático

- [x] ID 1 (parcial; aguarda decisão sobre Inbox/histórico em cargo restrito): criar conta QA "[TESTE] Validação TechSales" (techerp-permissions-qa@techerp-test.invalid) e validar permissões reais com sessão própria; relatório docs/architecture/task-1-real-user-validation.md
- [ ] Otimização do banco: aguardando decisão do usuário sobre retenção de logs e frequência das tarefas agendadas

# Roadmap — Importador Clockify → TechProjects (WK)

- [x] Migration aditiva: conexão cifrada, execuções, staging, vínculos, mapeamentos, RPC de escrita sem workflows
- [x] Adaptador Clockify somente leitura (allowlist de URLs, 429/Retry-After, Last-Page)
- [x] Motor retomável: inventário → prévia (dry run) → importação em lotes idempotentes com checkpoint/cancelamento
- [x] Segmentação por dia no fuso (meia-noite/DST), segundos preservados, sobreposições e timers abertos em staging
- [x] Mapeamento de usuários/clientes/projetos com revisão manual
- [x] Tela em /projects/settings/imports/clockify + item no menu e na central de importações
- [x] Testes com fixture (sem chamadas reais) e guia de migração
- [x] Teste lista workspaces reais com papel verificado (proprietário/admin/sem admin/não verificado); prévia bloqueada sem admin comprovado; origem escolhida manualmente por ID
- [ ] Conectar Clockify e escolher "WK Technology" por ID confirmado (bloqueado: aguarda o usuário colar a chave na tela; ele se declarou administrador, o teste da chave comprova)
- [ ] Rodar inventário/prévia real (bloqueado: depende do item acima)
- [ ] Importação real (bloqueado: aguarda prévia conferida pelo usuário)
- [ ] Agendar tick em segundo plano (bloqueado: depende de publicação aprovada)

# Roadmap — Importador Jibble → TechProjects (WK)

- [x] Validar endpoints na documentação oficial (OAuth, OData, async 202/303)
- [x] Tabelas multi-provedor `time_import_*` com RLS admin-only e desfazer protegido (0160–0162)
- [x] Cliente somente leitura (allowlist, nextLink, reautenticação, 429/5xx, export assíncrono)
- [x] Reconstrução In/Out/pausa, virada de dia/DST, conciliação com timesheets, duplicidade entre fontes
- [x] Motor retomável (prévia, recálculo, importação, desfazer) + tela + menu + agendador compartilhado
- [x] Testes (urls/cliente/reconstrução/conciliação/mapeamento/motor) e prova de acesso no banco
- [ ] Conectar o Jibble (bloqueado: aguarda o proprietário criar Client ID/Secret e colar na tela)
- [ ] Confirmar papel Owner/Admin e organização pelo ID (bloqueado: depende da conexão)
- [ ] Confirmar com dados reais o formato das pausas (não documentado na coleção pública)
- [ ] Prévia real, revisão de mapeamentos/duplicidades e importação (bloqueado: depende da conexão)
- [ ] Download privado de capturas de tela (não implementado; exige aprovação de armazenamento)
- [ ] Agendar o avanço em segundo plano (exige publicação aprovada)
- [x] Referência do nome da organização Jibble "WK" registrada (só destaca; seleção continua por ID + papel Owner/Admin)

# Clockify — catálogos
- [x] 82 tags, 6 grupos e 99 clientes concluídos (0163–0165)
- [ ] Revisar manualmente 5 membros de grupos sem pessoa mapeada (aguarda decisão do usuário)

# Roadmap — TechProjects Ciclo 2 (negócio ganho → entrega)

- [x] Banco: vínculo direto/relacional negócio↔projeto, política por workspace, fila com retry/lease, eventos/revisões, guardas de coerência
- [x] Ação central criar-ou-vincular (trigger de transição, worker no banco, ação de workflow)
- [x] Telas: negócio (Entrega/Preparação), projeto (origem), empresa, contrato, política, central › Negócios
- [x] Histórico: candidatos com explicação, vínculos exatos auditados/reversíveis, prévia e lote, criar faltante
- [x] Prova isolada SQL/RLS + testes + verify/build + Playwright; ativar política WK sem replay
- [ ] Prova ponta a ponta de um ganho real no WK (aguarda o primeiro negócio ganho de verdade; não criei negócio de teste no WK)
- [ ] Publicar (aguarda revisão do usuário)

# Roadmap — Telefones no padrão E.164 (todos os módulos)

- [x] Núcleo único `src/lib/phone/e164.ts` (libphonenumber max) + testes
- [x] Banco 0186: país padrão por workspace, ramal, backup/revisão, guarda opcional
- [x] Campo de telefone compartilhado (país, colagem, ramal, erro PT-BR) e país do workspace
- [x] Trocar entradas nas telas (CRM, ATS, People, Core, públicas, propriedades, edição em massa)
- [x] Servidor: APIs, importações, integrações, workflows, agentes, MCP
- [x] Canais: WhatsApp/voz continuam reconhecendo números antes/depois
- [x] Varredura WK: simulação → aplicar só seguros com backup → revisão
- [x] Tela de revisão/contagens e configuração do país
- [x] Docs/AGENTS
- [x] Testes (1.344), tipos, lint dos arquivos alterados, build e Playwright (desktop claro/escuro, celular, teclado)
- [x] Ligar a guarda do banco (`phone_strict_e164`) após publicação; importações gravam vazio quando o telefone não está no padrão
- [x] Limpeza autorizada: até 4 dígitos em branco (10.671) + 163 padronizações seguras, com backup
- [x] Fila reconcilia varredura e correções (6.416 pendentes reais)
- [x] Revisão por administrador dos 1.252 celulares antigos sem o 9 (tela + proteção no banco + provas)
- [ ] Administradores decidirem os 1.252 itens na tela (decisão humana, um a um)
- [ ] Demais 5.164 pendentes: corrigir na ficha do registro (decisão humana)
- [x] Publicação (23/10/2026)

# Roadmap — Campos de data (skill date-picker-br)

- [x] Inventário salvo (docs/architecture/date-fields.md): 89 controles em 61 arquivos + exceções justificadas
- [x] Controle único: DatePicker/DatePickerPanel + IsoDatePicker; data-hora usa o mesmo painel
- [x] Migração dos 6 módulos, Core, públicos e dinâmicos; "hoje" local nas telas convertidas
- [x] Guarda de regressão + testes (fusos, verão, bissexto, limites, atalhos, data-hora)
- [x] verify, build e navegador (amostra por módulo, teclado, celular, escuro)
- [ ] Formulário público com data no navegador (não há formulário com data cadastrado na WK; coberto por teste)
- [ ] Publicação (aguarda aceite do usuário)
