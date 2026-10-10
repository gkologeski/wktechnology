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

- [ ] ID 1: criar conta QA "[TESTE] Validação TechSales" (techerp-permissions-qa@techerp-test.invalid) e validar permissões reais com sessão própria; relatório docs/architecture/task-1-real-user-validation.md
- [ ] Otimização do banco: aguardando decisão do usuário sobre retenção de logs e frequência das tarefas agendadas
