# Notificações de mensagens atribuídas e timeline com laterais sincronizadas

## Objetivo

1. Toda nova mensagem recebida em uma conversa atribuída deve aparecer nas notificações do responsável, em WhatsApp, E-mail e Chat ao vivo.
2. Nas fichas de Lead, Contato, Empresa, Negócio e Chamado, a timeline deve rolar separadamente dos painéis laterais, mas mover esses painéis em proporção ao avanço da timeline, fazendo todos chegarem ao próprio final juntos.

## Situação atual confirmada

- O sino já recebe notificações em tempo real e existe a categoria `message`, com preferências de aviso no app, som, tremor e e-mail.
- WhatsApp já possui responsável (`assigned_to`) e distribuição automática; 6 de 8 conversas atuais estão atribuídas. Porém, a entrada de mensagem não cria notificação.
- Chat ao vivo possui `assignee_id`, mas hoje só assume o usuário quando ele responde; a entrada de mensagem não cria notificação.
- E-mail não possui responsável por conversa, portanto precisa receber essa capacidade antes de poder notificar corretamente.
- Não há notificações do tipo `message` gravadas atualmente.
- As cinco fichas comerciais usam o mesmo `RecordLayout`. Hoje as três colunas pertencem à mesma rolagem da página e terminam em alturas diferentes; não existe sincronização.
- As telas ATS também usam `RecordLayout`, mas não usam esta timeline comercial; ficarão fora da mudança.

## Implementação

### 1. Responsável unificado nos três canais

- Adicionar `assigned_to` às conversas de E-mail e padronizar o uso do `assignee_id` já existente no Chat.
- Expor seleção de responsável nas telas de E-mail, WhatsApp e Chat, validando no servidor que o destinatário é membro ativo do mesmo workspace.
- Exibir responsável e filtros “Minhas”, “Sem responsável” e “Todas” nos três canais, seguindo o padrão já existente no WhatsApp.
- Preservar responsáveis já definidos e não sobrescrever atribuições manuais.
- Aplicar a Central de Distribuição às novas conversas de E-mail e Chat quando houver regra ativa para o respectivo canal; sem regra, manter “Sem responsável”.

### 2. Notificação de cada mensagem recebida

- Criar um serviço servidor único para notificações da Inbox, reutilizado pelos processadores de WhatsApp, sincronização de E-mail e entrada pública do Chat.
- Após persistir uma mensagem `inbound`, localizar o responsável atual da conversa e criar uma notificação `message` para ele.
- Respeitar a preferência “Mensagens → No app”; som e tremor continuam sendo aplicados pelo sino quando a notificação chega.
- Usar chave idempotente por canal + mensagem + usuário para impedir notificações duplicadas em reprocessamentos de webhook ou sincronização.
- A notificação mostrará canal, remetente/cliente e uma prévia segura, com link para a conversa no canal correto.
- Não notificar mensagens enviadas pela equipe, conversas sem responsável, usuários inativos ou eventos de status/leitura.
- Quando uma conversa for reatribuída, apenas as próximas mensagens irão para o novo responsável; o histórico de notificações não será transferido.

### 3. Timeline e painéis laterais desacoplados

- Criar uma opção explícita no `RecordLayout` para o modo de timeline sincronizada e ativá-la somente em Lead, Contato, Empresa, Negócio e Chamado.
- Em desktop com três colunas, transformar timeline, propriedades e associações em regiões de rolagem independentes dentro da altura disponível da tela.
- Usar a timeline central como guia. A cada rolagem, calcular:

```text
progresso = posição atual da timeline / percurso total da timeline
posição lateral = progresso × percurso total do painel lateral
```

- Sincronizar separadamente cada lateral. Assim, um painel curto se move devagar e um painel longo se move mais rápido, mas ambos atingem 100% quando a timeline atinge 100%.
- Recalcular as proporções quando atividades, associações, propriedades ou dimensões da janela mudarem, sem saltos e sem ciclos de rolagem.
- Permitir rolagem manual de cada lateral; ela volta a acompanhar proporcionalmente somente quando a timeline for rolada novamente.
- Em tablet e celular, manter o fluxo vertical atual, sem rolagens internas sincronizadas.
- Painéis que não ultrapassam a altura disponível permanecem estáticos, sem barra de rolagem artificial.

## Segurança, banco e compatibilidade

- Migration aditiva para o responsável de E-mail e para a chave idempotente das notificações, preservando dados, RLS e permissões existentes.
- Toda atribuição manual será autorizada no servidor e limitada ao workspace ativo.
- Processadores externos continuarão usando as validações e credenciais já existentes; nenhuma integração será simulada.
- Nenhuma mudança nas regras de identidade Contato/Lead, no conteúdo das mensagens ou nas telas ATS.

## Validação

- Testes unitários do serviço de notificação: três canais, entrada versus saída, sem responsável, usuário inativo, preferência desligada, reprocessamento idempotente e reatribuição.
- Testes do cálculo proporcional: laterais mais curtas/longas, painel sem overflow, mudança de altura e chegada simultânea ao final.
- Playwright autenticado nos três canais: atribuir conversa, registrar/receber mensagem de teste controlada, confirmar item no sino e abertura do canal correto.
- Playwright nas cinco fichas, em desktop: meio e fim da timeline, painel esquerdo e direito, conteúdo assíncrono e ausência de travamentos.
- Conferir tablet/celular, modo claro/escuro, teclado, foco e ausência de sobreposição.
- Executar testes afetados, typecheck, lint dos arquivos alterados, build e revisar o diff final.
