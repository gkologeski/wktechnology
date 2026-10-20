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

- [ ] Banco: vínculo direto/relacional negócio↔projeto, política por workspace, fila com retry/lease, eventos/revisões, guardas de coerência
- [ ] Ação central criar-ou-vincular (trigger de transição, worker no banco, ação de workflow)
- [ ] Telas: negócio (Entrega/Preparação), projeto (origem), empresa, contrato, política, central › Negócios
- [ ] Histórico: candidatos com explicação, vínculos exatos auditados/reversíveis, prévia e lote, criar faltante
- [ ] Prova isolada SQL/RLS + testes + verify/build + Playwright; ativar política WK sem replay
- [ ] Publicar (aguarda revisão do usuário)
