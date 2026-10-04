# Redesign da Inbox multicanal

## Objetivo
Aplicar à **Inbox Unificada, Email, WhatsApp e Chat ao vivo** a direção aprovada **Hyper-efficient multi-channel cockpit**, transformando a área em uma central operacional de quatro painéis, sem alterar integrações, permissões, dados ou regras de envio.

A paleta, as fontes, os raios e os destaques continuarão vindo integralmente do **White Label ativo**. As cores e a fonte ilustrativas do protótipo não serão copiadas.

## Experiência aprovada

### 1. Casco compartilhado de quatro painéis
- Preservar a navegação global do TechERP.
- Reestruturar a área útil da Inbox em:
  1. canais e filas;
  2. lista de conversas;
  3. conversa ativa;
  4. contexto do contato, recolhível.
- Dar maior largura e prioridade visual à conversa ativa.
- Manter rolagem independente em canais, lista, histórico e contexto.
- No mobile, usar navegação progressiva entre canais, lista e conversa; o contexto abre sob demanda.

### 2. Navegação e triagem
- Consolidar **Unificada, Email, WhatsApp e Chat ao vivo** na primeira coluna, com indicação do canal ativo.
- Preservar os filtros existentes do WhatsApp: **Minhas, Sem dono e Todas**.
- Reorganizar busca, contagem, não lidas, horário, canal, responsável e estado da conversa para leitura rápida.
- Manter seleção e atualizações em tempo real sem recarregar a tela.

### 3. Conversa e composição
- Padronizar cabeçalho, histórico, balões, horários e estados de envio/leitura.
- Preservar as funções já existentes:
  - **Unificada:** busca, filtros de canal, resposta inline, rascunho, sugestão por IA e abertura no canal original;
  - **Email:** sincronização, novo email, resposta, anexos, aberturas e cliques;
  - **WhatsApp:** nova conversa, configuração, atribuição, fechar/reabrir, mídia, rascunho e status;
  - **Chat ao vivo:** resposta com snippets, encerramento e conversão em ticket.
- Tornar o compositor uma área operacional estável, sem alterar atalhos, validações ou bloqueios atuais.

### 4. Contexto do contato
- Manter somente informações já disponíveis em cada canal.
- Organizar identidade, canal, responsável, status e atalhos existentes em seções compactas.
- Permitir recolher o painel para ampliar a conversa.
- Não criar novos campos, vínculos ou dados de exemplo.

### 5. Estados, acessibilidade e White Label
- Refinar estados de carregamento, vazio, erro, envio em andamento e ações desabilitadas.
- Garantir foco visível, nomes acessíveis, navegação por teclado, áreas roláveis anunciadas e alvos adequados no mobile.
- Usar apenas componentes oficiais e tokens semânticos já ligados ao White Label.
- Validar modo claro e escuro, sem cores fixas do protótipo e sem cartões aninhados.
- Usar transições curtas e discretas, respeitando redução de movimento.

## Implementação técnica
- Evoluir `src/components/inbox/inbox-workspace.tsx` como casco visual compartilhado, incluindo navegação de canais, composição dos quatro painéis e comportamento responsivo.
- Manter componentes compartilhados para item da lista, cabeçalho, balão, status, vazio, carregamento e contexto.
- Ajustar somente a composição das quatro rotas da Inbox para consumir o novo casco, preservando suas consultas, mutations, realtime, rascunhos e funções de servidor atuais.
- Manter os metadados exclusivos já existentes nas quatro rotas.
- Registrar a decisão estrutural no guia técnico apenas se a implementação alterar a regra arquitetural já documentada.

## Validação
- Revisar o diff para confirmar ausência de mudanças em banco, RLS, RBAC, integrações e regras de negócio.
- Executar testes focados, typecheck, lint e build disponíveis.
- Validar com Playwright as quatro rotas em 1280 px e 360 px: troca de canal, seleção de conversa, filtros, contexto recolhível, estados vazio/carregando e compositores habilitados/desabilitados.
- Conferir visualmente modo claro e escuro e ausência de sobreposição, cortes ou rolagem concorrente.
- Confirmar no fluxo real as ações disponíveis sem disparar mensagens externas durante a validação.

## Escopo confirmado
- **Incluído:** redesign visual e estrutural das quatro telas, casco compartilhado, responsividade, acessibilidade e estados.
- **Não incluído:** novos canais, novas filas, mudanças de integração, banco, permissões, automações ou comportamento de envio.
