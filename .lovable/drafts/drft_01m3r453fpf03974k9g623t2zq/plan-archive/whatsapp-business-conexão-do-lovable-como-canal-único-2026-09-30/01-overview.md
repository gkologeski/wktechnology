# WhatsApp Business: conexão do Lovable como canal único

## Objetivo
Todo envio e recebimento de WhatsApp do TechERP passa a usar só a conexão do Lovable (hoje, o número +55 48 6137-0317). A configuração antiga da Meta, em que se colavam o WABA ID e o token, sai do sistema.

## O que muda para você
1. **Envio:** caixa de entrada, botão "Enviar WhatsApp" em leads, contatos, empresas e negócios, campanhas e régua de cobrança passam a sair pelo número conectado.
2. **Botão liberado:** "Enviar WhatsApp" aparece disponível sempre que a conexão estiver ativa. Sem conexão, aparece a engrenagem que leva ao painel.
3. **Recebimento:** as respostas dos clientes entram nas conversas e na timeline. Os avisos de enviado, entregue, lido e falhou atualizam cada mensagem.
4. **Novo painel em Configurações › WhatsApp** (substitui a tela antiga):
   - mostra o número conectado, o nome exibido, a qualidade e o status;
   - tem "Testar conexão" e "Atualizar dados";
   - tem "Trocar número" e "Desconectar", com o passo a passo.
5. **Trocar de número:** o próprio TechERP não consegue desconectar nem conectar a conta, por segurança. A troca é feita no painel de Conectores do Lovable, ou você pede aqui no chat e eu faço. Depois disso, o painel já mostra o número novo sozinho.
6. **Configuração antiga removida:**
   - saem o formulário, o passo a passo com imagens, o webhook antigo e a lógica de envio direto pela Meta;
   - as conversas e mensagens já registradas continuam visíveis;
   - as tabelas antigas ficam guardadas no banco, sem uso. Apagá-las fica para depois, se você quiser.
7. **Janela de 24 horas:** mantida. Fora dela, o sistema exige um modelo aprovado pela Meta e avisa isso com clareza.
