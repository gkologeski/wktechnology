# Timeline do WhatsApp fiel ao aplicativo

## Objetivo
Atualizar as conversas de WhatsApp na timeline para usar o visual claro do aplicativo, com fundo padronizado, mensagens do cliente em branco e mensagens do usuário em verde-claro.

## Implementação
1. **Identificar corretamente o usuário nas novas conversas**
   - Ler com segurança o nome completo e o telefone do usuário autenticado.
   - Normalizar nomes, acentos, espaços e formatos de telefone antes da comparação.
   - Classificar como mensagem do usuário, nesta ordem:
     1. remetente antes de `:` igual ao nome do usuário;
     2. remetente igual ao telefone do usuário;
     3. remetente contendo o nome de um usuário do workspace seguido pelo telefone dele, quando essa identificação estiver disponível no próprio texto.
   - Classificar todos os demais remetentes como cliente.

2. **Reproduzir o visual do WhatsApp**
   - Substituir o fundo preto pelo padrão claro característico do WhatsApp.
   - Usar balões brancos para o cliente e verde-claro para o usuário.
   - Ajustar texto, horário, confirmação de leitura, espaçamento, cantos e alinhamento para se aproximarem do aplicativo real.
   - Manter o conteúdo legível no modo claro e escuro do TechERP, sem alterar o restante da timeline.

3. **Atualizar conversas já salvas**
   - Reconhecer, ao exibir, o HTML antigo gerado pelo TechERP e converter suas cores e fundo para o novo visual.
   - Preservar o lado já registrado para cada balão antigo, pois o HTML salvo não contém mais o nome original de cada remetente e não permite reclassificação confiável.
   - Aplicar a identificação completa por nome/telefone às novas conversas e às conversas antigas que forem novamente coladas ou editadas a partir do texto exportado.

4. **Manter criação e edição consistentes**
   - Aplicar a mesma conversão ao criar ou editar uma atividade com texto exportado do WhatsApp.
   - Não interferir em notas comuns, e-mails, chamadas ou outras atividades.

5. **Cobertura e validação**
   - Testar nome exato, variações de acento/caixa, telefone formatado, identificação composta e fallback para cliente.
   - Testar a modernização do HTML antigo e garantir que conteúdo potencialmente malicioso continue sanitizado.
   - Executar testes, verificação de tipos e lint.
   - Conferir no navegador uma conversa nova e uma antiga na timeline, em tela ampla e estreita.

## Arquivos previstos
- `src/lib/whatsapp-paste.ts`
- `src/lib/whatsapp-paste.test.ts`
- `src/lib/timeline/activity-entities.ts`
- `src/components/activity-timeline.tsx`
- `src/components/activity/use-activity-editing.ts`
- `src/components/activity/activity-timeline-item.tsx` ou um componente específico de conversa, se necessário para modernizar registros antigos sem alterar outros conteúdos.

## Limites
- Nenhuma mudança no envio de WhatsApp, integrações, permissões ou estrutura do banco.
- Conversas antigas manterão a direção já gravada quando o remetente original não puder ser recuperado com segurança.
