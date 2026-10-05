# Plano — Inbox: janela de 24 horas, avisos e layout

## Resultado esperado

- Impedir mensagens livres de WhatsApp fora das 24 horas desde a última mensagem recebida.
- Ao tentar enviar fora da janela, manter o texto digitado e abrir a seleção de modelos aprovados pela Meta, com prévia e variáveis.
- Mostrar aviso de nova mensagem apenas quando a conversa passa a ter a primeira mensagem não lida e o usuário não está na Inbox unificada.
- Corrigir o corte da tela com três painéis fluidos, mantendo a paleta neutra atual e Sora + Manrope.

## Implementação

1. **Proteção da janela no envio**
   - Validar a janela de 24 horas no servidor antes de qualquer envio livre, inclusive anexos e respostas contextuais.
   - Permitir fora da janela somente um modelo com status `APPROVED` no catálogo do workspace.
   - Retornar um erro estruturado de “modelo obrigatório”, sem chamar a Meta nem gravar mensagem/conversa como enviada.
   - Aplicar a mesma regra a todos os pontos que usam o envio individual de WhatsApp, não apenas à tela da Inbox.

2. **Sugestão de modelo aprovado**
   - Na conversa da Inbox, ao tentar enviar fora da janela, abrir um seletor com somente modelos aprovados, corpo de prévia e campos das variáveis.
   - Preservar o rascunho livre enquanto o usuário escolhe o modelo.
   - No diálogo de envio existente, detectar a janela antes do envio e trocar para o modo de modelo quando necessário.
   - Exibir estados de carregamento, ausência de modelos aprovados e falha ao carregá-los; sem oferecer modelos pendentes ou rejeitados.

3. **Avisos sem repetição**
   - Remover confirmações visuais rotineiras de mensagem enviada e sincronização sem novidades.
   - Disparar aviso recebido apenas na transição de zero para uma mensagem não lida.
   - Suprimir o aviso quando o usuário estiver em qualquer tela da Inbox unificada; manter a notificação na central.
   - Evitar duplicidade entre o aviso em tempo real e o aviso originado pela notificação persistida.

4. **Correção visual da Inbox**
   - Fazer a Inbox ocupar somente a altura realmente disponível dentro do aplicativo, sem somar novamente cabeçalho e espaçamentos externos.
   - Manter três painéis fluidos: lista, conversa e contexto; permitir recolher o contexto em larguras menores.
   - Reduzir molduras e sombras, preservar superfícies contínuas e garantir que cabeçalhos, mensagens e compositor não sejam cortados.
   - Manter paleta `#F7F9FC`, `#FFFFFF`, `#DCE3EC`, `#2563A6`, tipografia Sora + Manrope e tokens White Label.

## Detalhes técnicos

- A fonte da janela será `whatsapp_conversations.last_inbound_at`; ausência ou data inválida significa janela fechada.
- A regra será autoritativa no servidor; desabilitar controles na interface será apenas prevenção adicional.
- O catálogo existente `wa_templates` será filtrado por workspace e `APPROVED`; o servidor também validará nome e idioma antes do envio.
- Nenhuma mudança de schema, RLS ou integração de canal está prevista.

## Validação

- Testes unitários para limite de 24 horas, data ausente/inválida, modelo aprovado e tentativa com modelo não aprovado.
- Testes dos fluxos de Inbox e diálogo: envio livre dentro da janela; bloqueio e sugestão fora dela; envio por modelo; ausência de modelos.
- Teste dos avisos: primeira não lida fora da Inbox, mensagens seguintes silenciosas e nenhuma exibição dentro da Inbox.
- Playwright em desktop e mobile para confirmar os três painéis, compositor visível, ausência de cortes e fluxo completo de sugestão do modelo.
- Executar formatação, testes dirigidos, verificação de tipos, lint/diff e compilação; revisar o código alterado antes da entrega.
