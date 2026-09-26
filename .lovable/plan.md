# Central de atividades em janelas flutuantes

## Objetivo
Transformar todas as ações manuais de criação, edição e detalhamento de atividades do TechERP em janelas flutuantes no canto inferior direito, no padrão HubSpot/Gmail, preservando os campos, integrações, permissões e comportamentos atuais.

Decisões confirmadas:
- permitir várias janelas simultâneas;
- manter janelas abertas ou minimizadas ao navegar entre páginas;
- no celular, abrir a janela ativa em tela cheia;
- nenhuma alteração em regras de negócio, RLS, permissões ou automações.

## Levantamento confirmado

### Timeline compartilhada
A timeline central de atividades é reutilizada nos detalhes de Leads, Contatos, Empresas, Negócios e Tickets, no detalhe rápido de Negócios e na fila de Prospecção. Ela oferece:
- Nota e Tarefa;
- registro de E-mail, Ligação, Reunião, WhatsApp, SMS, LinkedIn e Correspondência;
- envio de E-mail e WhatsApp;
- discador de Ligação;
- agendamento de Reunião;
- Pesquisa/Qualificação;
- tarefa de acompanhamento;
- edição de atividade já salva.

### Outros acessos manuais encontrados
- criação em massa de atividades nas listas de Leads, Contatos, Empresas e Negócios;
- criação e edição de Tarefas nas páginas e quadros de tarefas;
- novo e-mail, resposta e envio de cotação por e-mail;
- nova conversa de WhatsApp;
- execução de filas de tarefas e prospecção;
- detalhe de reunião e ações derivadas, como criar tarefas;
- páginas de Notas e Comunicações, hoje apoiadas pelo formulário genérico de registros.

### Fora da conversão visual
Permanecem como estão as linhas do tempo somente informativas de pipeline de vagas, entrega de projetos, importações, histórico de propriedades e eventos técnicos. Automações, workflows, sincronizações, APIs e webhooks que geram atividades sem janela também permanecem inalterados.

## 1. Criar o gerenciador global de janelas
- Montar uma central única na área autenticada, acima das páginas, para que as janelas sobrevivam à navegação.
- Manter uma coleção de janelas por ação, registro e contexto, evitando duplicatas acidentais e permitindo várias instâncias legítimas.
- Cada janela terá título, entidade associada, tipo, estado aberto/minimizado, ordem visual e estado de foco.
- Ao clicar numa janela, trazê-la para frente; organizar as abertas lado a lado a partir do canto inferior direito.
- Quando não houver espaço, manter as excedentes como abas minimizadas acessíveis, sem cobrir controles críticos da página.

## 2. Construir a moldura flutuante do Design System
- Cabeçalho compacto com ícone/tipo, nome do registro, minimizar, restaurar, expandir e fechar.
- Corpo rolável e rodapé de ações fixo, usando tokens semânticos e o Destaque configurado no White Label.
- Estados de carregamento, salvamento, erro, desabilitado e rascunho visíveis sem bloquear outras janelas.
- Confirmação antes de descartar conteúdo não salvo; fechar após sucesso remove a janela.
- Preservar diálogos auxiliares necessários, como confirmação, calendário, seleção de arquivos, menus e associações, como camadas internas da janela.

## 3. Adaptar os conteúdos existentes sem duplicar regras
Separar o conteúdo funcional dos wrappers modais atuais e reutilizá-lo tanto na central quanto onde algum fluxo ainda exigir composição controlada:
- compositor HubSpot de Nota/Tarefa e registros manuais;
- E-mail e resposta, incluindo templates, snippets, anexos e rascunho automático;
- WhatsApp, incluindo templates, mídia, tokens e rascunho automático;
- Ligação, preservando chamada ativa, cronômetro, mute, encerramento e registro;
- Reunião, calendário, participantes e sala;
- Pesquisa/Qualificação;
- criação em massa;
- edição de atividade e tarefa de acompanhamento;
- detalhe de reunião quando aberto a partir de uma atividade.

## 4. Migrar todos os pontos de entrada
- Fazer a barra de ações de todas as timelines abrir a central flutuante, removendo o compositor inline e os modais centrais dessas ações.
- Migrar as ações equivalentes em Notas, Comunicações, Tarefas, filas, Inbox de E-mail, Inbox de WhatsApp, cotações e ações em massa.
- Preservar exatamente o contexto de origem: registro, destinatário, associações, responsável, seleção em massa, thread e callbacks de atualização.
- Atualizar todas as timelines relacionadas após salvar/enviar, inclusive quando a página original já não estiver aberta.

## 5. Persistência e segurança do trabalho em andamento
- Manter estado e arquivos selecionados em memória enquanto o usuário navega na sessão autenticada.
- Reaproveitar os rascunhos persistidos existentes para E-mail e WhatsApp.
- Manter os demais formulários enquanto a janela estiver aberta ou minimizada; não prometer restauração após recarregar/fechar o navegador nesta etapa.
- Uma Ligação em andamento não poderá ser descartada ou desmontada ao minimizar/navegar; fechar exigirá encerramento consciente.
- Preservar a sessão de auditoria enquanto a janela existir e consolidar o log somente ao salvar/fechar, como ocorre nos diálogos atuais.
- Limpar todas as janelas no logout ou troca de usuário/workspace para impedir vazamento de contexto.

## 6. Comportamento responsivo e acessível
- Desktop/tablet: janelas lado a lado, redimensionadas dentro da área útil, com pilha minimizada no rodapé.
- Celular: uma janela ativa em tela cheia; as demais ficam acessíveis por uma barra compacta de janelas.
- Navegação completa por teclado, foco inicial e retorno de foco ao gatilho, nomes acessíveis nos botões de ícone e regiões anunciadas.
- `Esc` minimiza primeiro; fechar explícito decide salvar o rascunho ou descartar quando houver alterações.
- Validar contraste, foco, alvos de toque e temas claro/escuro.

## 7. Arquitetura e documentação
- Criar uma API tipada de comandos para abrir, focar, minimizar, restaurar e fechar janelas sem acoplar as páginas ao estado interno.
- Registrar no guia técnico a central global como único padrão para ações manuais de atividade.
- Documentar o inventário final com cada ponto de entrada, tipo de janela, módulo e resultado da migração.
- Registrar a decisão arquitetural no `AGENTS.md` e acompanhar a execução no `roadmap.md`.

## 8. Testes e validação
- Testes unitários do gerenciador: deduplicação, ordenação, foco, minimizar/restaurar, fechamento com alterações e limpeza por sessão.
- Testes dos adaptadores para garantir que os mesmos dados e associações chegam às operações atuais.
- Fluxos ponta a ponta: abrir várias ações em registros diferentes, minimizar, navegar, restaurar, salvar e conferir a atividade na timeline correta.
- Cobrir Nota, Tarefa recorrente, acompanhamento, E-mail, WhatsApp, Ligação, Reunião, Pesquisa, edição e criação em massa.
- Validar em 360, 768, 1024 e 1280 px, nos temas claro e escuro, sem sobreposição incoerente ou estouro horizontal.
- Executar typecheck, lint, testes unitários afetados, testes E2E direcionados, build de desenvolvimento e revisão do diff.

## Critérios de aceite
- Nenhuma ação manual de atividade identificada no inventário abre mais como modal central ou compositor inline.
- Várias janelas podem coexistir, permanecer entre páginas e ser minimizadas/restauradas sem perda de dados.
- No celular, a janela ativa ocupa a tela e continua permitindo alternar entre rascunhos.
- Envio, salvamento, recorrência, associações, anexos, auditoria, permissões e atualização das timelines mantêm o comportamento atual.
- Processos automáticos e timelines meramente informativas não sofrem alteração.
