# Redesign da Inbox multicanal

## Objetivo
Transformar **Inbox Unificada, Email, WhatsApp e Chat ao Vivo** em uma central operacional coerente, baseada na direção visual **Modern unified interface v2**, sem alterar regras, integrações, permissões ou banco de dados.

A composição seguirá o mockup aprovado, mas **cores, tipografia, densidade, raios e ícones continuarão vindo integralmente do White Label ativo do workspace**, inclusive nos modos claro e escuro.

## Experiência proposta

### 1. Estrutura compartilhada
- Criar um casco comum de Inbox com altura útil da aplicação e quatro áreas:
  1. navegação interna de canais e filas;
  2. lista de conversas;
  3. conversa selecionada;
  4. painel contextual recolhível.
- Manter a navegação global atual do TechERP; a nova navegação ficará restrita à Inbox.
- Destacar o canal por ícone e rótulo sem substituir a cor primária definida pelo White Label.
- Adaptar a composição responsivamente: quatro áreas no desktop largo, contexto recolhível no desktop menor e navegação progressiva lista → conversa no mobile.

### 2. Navegação, busca e triagem
- Unificar o acesso a **Unificada, Email, WhatsApp e Chat ao Vivo** no painel de canais.
- Preservar os filtros atuais de WhatsApp: **Minhas, Sem dono e Todas**.
- Posicionar busca, contagem, estado não lido, horário, responsável e status na lista com hierarquia consistente.
- Preservar seleção e atualização em tempo real sem recarregar a tela inteira.

### 3. Conversa e composição
- Padronizar cabeçalho, histórico, separadores de data, mensagens recebidas/enviadas e estados de entrega.
- Preservar recursos existentes por canal:
  - **Unificada:** resposta inline, IA e acesso ao canal original;
  - **Email:** sincronização, novo email, resposta, anexos, aberturas e cliques;
  - **WhatsApp:** nova conversa, atribuição, fechar/reabrir, mídia, rascunho e estados enviado/entregue/lido;
  - **Chat ao Vivo:** resposta rápida, snippets, encerramento e conversão em ticket.
- Reorganizar ações secundárias em menus ou controles compactos, mantendo uma ação primária clara.

### 4. Contexto do contato
- Exibir somente dados já disponíveis: identificação, empresa ou contato relacionado, responsável, canal e atalhos existentes.
- Tornar o painel recolhível para ampliar a conversa.
- Não criar novos vínculos, campos ou regras de negócio durante o redesign.

### 5. Estados e acessibilidade
- Padronizar skeleton de carregamento, vazio, erro, canal não configurado, envio em andamento e ação desabilitada.
- Garantir foco visível, navegação por teclado, nomes acessíveis, áreas roláveis independentes e mensagens anunciadas quando necessário.
- Validar ausência de sobreposição e perda de conteúdo em desktop, tablet e mobile.

## Implementação técnica
- Extrair componentes compartilhados de apresentação para o casco, navegação de canais, lista, cabeçalho da conversa, área de mensagens, composição e painel contextual.
- Manter consultas, funções de envio, sincronização, realtime, rascunhos e mutations existentes nas rotas atuais; apenas conectá-las à nova apresentação.
- Usar exclusivamente componentes oficiais e tokens semânticos já definidos; sem cores fixas do protótipo e sem cartões aninhados.
- Adicionar metadados próprios e exclusivos às quatro rotas da Inbox.
- Registrar a decisão arquitetural do casco compartilhado no guia técnico do projeto.

## Validação
- Validar com Playwright os quatro canais em desktop e mobile, incluindo seleção, envio disponível/desabilitado, troca de canal, filtros, abertura do contexto e estados vazio/erro.
- Executar testes focados existentes, typecheck, lint e build disponíveis.
- Revisar visualmente os modos claro e escuro e pelo menos os três arquétipos White Label: Quiet Premium, Modern Soft e Enterprise Classic.
- Confirmar que nenhuma migration, RLS, permissão ou regra de negócio foi alterada.

## Escopo confirmado
- **Incluído:** redesign visual e estrutural das quatro telas, componentes compartilhados, responsividade, acessibilidade, estados e metadados.
- **Não incluído:** novos canais, mudanças de integração, novas automações, alteração de banco, RLS, RBAC ou comportamento de envio.
