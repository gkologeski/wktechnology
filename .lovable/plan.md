# Consolidar logs de alterações feitas em modais

## Objetivo

Manter o salvamento automático dos formulários, mas registrar no log do sistema apenas o resultado consolidado de cada sessão do modal: valor inicial → último valor persistido antes do fechamento.

A regra será aplicada a todos os formulários em modal que salvam durante a edição. Modais que já gravam apenas uma vez no botão de confirmação não terão seu comportamento alterado.

## Comportamento esperado

- Ao abrir um modal, iniciar uma sessão de edição identificada de forma única.
- Continuar persistindo cada alteração necessária para autosave, cálculos, totais e recuperação de falhas.
- Dentro da mesma sessão, manter somente um evento de auditoria por registro alterado:
  - o estado anterior permanece sendo o estado existente antes da primeira alteração;
  - o estado posterior é substituído pelo último estado efetivamente salvo;
  - campos que voltarem ao valor inicial deixam de constar como alteração.
- Ao fechar por botão, `X`, clique externo, `Esc` ou após concluir a ação, aguardar gravações pendentes e finalizar a sessão.
- Criações, exclusões, aprovações e outras ações discretas continuam com eventos próprios; somente atualizações contínuas serão consolidadas.
- Sessões interrompidas por recarregamento, queda de conexão ou fechamento da aba preservarão o último estado já persistido, sem perder a auditoria.

## Implementação

### 1. Sessão de auditoria no backend

- Criar uma estrutura de sessão de edição vinculada a workspace, usuário, modal e identificador único.
- Estender o registro de auditoria para permitir consolidação idempotente por sessão + entidade + registro + ação.
- Preservar o primeiro `before` e atualizar apenas o `after` a cada gravação da mesma sessão.
- Finalizar e limpar sessões com segurança, incluindo expiração automática para sessões abandonadas.
- Manter RLS, GRANTs e checagem de workspace/usuário; nenhuma permissão será ampliada.

### 2. Contrato reutilizável para modais

- Criar um controlador/hook compartilhado para abrir, tocar, finalizar e recuperar uma sessão de auditoria.
- Integrá-lo ao ciclo acessível de Dialog, Sheet e Drawer sem alterar seus componentes visuais.
- Bloquear o fechamento somente enquanto existir uma gravação já iniciada; exibir erro e permitir nova tentativa quando a finalização falhar.
- Evitar colisões entre dois modais, abas ou registros abertos simultaneamente.

### 3. Itens de linha do negócio

- Integrar primeiro o editor de itens de linha como caso de referência.
- Preservar autosave, desfazer, botão Salvar, inclusão/remoção, cálculo dos totais e atualização do valor do negócio.
- Consolidar as várias atualizações indiretas de `deals.value` em um único evento da sessão, do valor original ao total final.
- Evitar eventos sem mudança líquida quando o usuário alterar e depois restaurar o valor original.

### 4. Aplicação a todos os formulários em modal

- Inventariar Dialogs, Sheets e Drawers com persistência em `onChange`, `onValueChange`, blur, debounce ou autosave.
- Migrar apenas esses fluxos para o contrato compartilhado, por domínio: CRM, TechHire, TechPeople, Contratos, Financeiro, Projetos, Serviços, Prospecção e Configurações.
- Preservar funções de negócio, workflows, cálculos, notificações, realtime, desfazer e invalidações de cache existentes.
- Manter formulários de envio único fora da consolidação, evitando mudanças sem efeito.

## Testes e validação

- Testes unitários da consolidação: múltiplos valores, múltiplos campos, retorno ao valor inicial, sessões concorrentes e repetição idempotente.
- Testes de integração do backend para isolamento por workspace/usuário, expiração e falha de finalização.
- Teste do editor de itens: várias digitações devem produzir um único log com valor inicial e final corretos.
- Testes representativos de Dialog, Sheet e Drawer com fechamento por todas as formas suportadas.
- Confirmar que create/delete permanecem separados e que workflows não deixam de executar.
- Executar typecheck, lint, testes completos, build de desenvolvimento e smoke tests desktop/mobile em tema claro e escuro.

## Critérios de aceite

- Nenhum log novo é criado por cada `onChange` dentro da mesma sessão de modal.
- O histórico mostra somente a mudança líquida inicial → final por registro.
- Dados continuam sendo salvos durante a edição e sobrevivem a interrupções.
- Modais simultâneos não consolidam eventos entre si.
- RLS, RBAC, isolamento de workspace e registros de ações discretas permanecem intactos.
