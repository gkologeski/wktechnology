# Navegação horizontal da Inbox

## Objetivo
Mover o menu de canais da Inbox da coluna lateral para uma faixa horizontal no topo, liberando largura para a lista de conversas, a conversa ativa e o contexto, sem alterar recursos ou regras dos canais.

## Diagnóstico confirmado
- O casco compartilhado reserva atualmente uma coluna exclusiva de `10–12rem` para **Unificada, Email, WhatsApp e Chat ao vivo**.
- Essa coluna também contém o título, a descrição e as ações específicas de cada canal.
- Com o contexto aberto, a tela usa quatro colunas; por isso, na largura atual, lista e conversa ficam comprimidas.
- As quatro rotas consomem o mesmo `InboxWorkspace`, então a mudança pode ser feita no casco compartilhado e refletir em toda a Inbox.

## Alterações

### 1. Cabeçalho horizontal compartilhado
- Criar uma faixa superior única dentro da Inbox.
- Manter título e descrição à esquerda.
- Posicionar os canais **Unificada, Email, WhatsApp e Chat ao vivo** horizontalmente, com ícone, rótulo e estado ativo.
- Colocar as ações específicas do canal à direita, como **Sincronizar**, **Novo email**, **Configurar** e **Nova conversa**.
- Permitir rolagem horizontal controlada da navegação em larguras pequenas, sem esticar a página.

### 2. Área principal mais ampla
- Remover a coluna lateral de canais.
- Redefinir o conteúdo para duas colunas principais — lista e conversa — e uma terceira coluna opcional para contexto.
- Aumentar a largura útil da lista e principalmente da conversa.
- Preservar o recolhimento do contexto e as rolagens independentes.

### 3. Responsividade
- No desktop, manter a faixa superior em uma linha quando houver espaço e permitir que as ações se acomodem sem comprimir as abas.
- Em tablet, separar título/ações e canais em linhas internas do mesmo cabeçalho.
- No celular, manter os canais no topo com rolagem horizontal e a navegação progressiva lista → conversa.
- Evitar cortes, sobreposição e rolagem horizontal da página.

### 4. Preservação funcional
- Não alterar filtros, busca, seleção de conversas, rascunhos, envio, atribuição, fechamento, sincronização, IA, anexos ou contexto.
- Não alterar dados, banco, permissões, integrações ou regras de negócio.
- Continuar usando os tokens do White Label e os componentes oficiais.

## Arquivos previstos
- `src/components/inbox/inbox-workspace.tsx`: nova composição horizontal e grade principal sem a coluna de canais.
- `roadmap.md`: atualização do registro do redesign.
- As quatro rotas só serão ajustadas se a nova disposição exigir pequenas adaptações de ações; a lógica será preservada.

## Validação
- Revisar o diff e confirmar que a alteração ficou restrita à apresentação da Inbox.
- Executar lint, verificação de tipos e conferir a compilação automática.
- Testar com Playwright as quatro rotas em desktop e celular.
- Conferir troca de canal, seleção de conversa, ações do cabeçalho, contexto recolhível e ausência de transbordo.
- Revisar visualmente os modos claro e escuro.
