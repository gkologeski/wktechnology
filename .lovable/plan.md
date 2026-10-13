# Campanhas de WhatsApp: editar, excluir e duplicar

## Situação atual
- A tela já tem o botão **Editar**, mas ele só aparece para campanhas em rascunho ou pausadas. Isso continua assim: editar uma campanha que está em envio causaria mensagens diferentes dentro da mesma campanha.
- Não existe a opção de excluir nem a de duplicar.

## O que muda
1. **Editar**: o botão continua disponível em rascunho e pausada. Em campanhas em envio, concluídas ou canceladas, o botão aparece desativado e explica o motivo ao passar o mouse.
2. **Duplicar** (todas as campanhas):
   - Cria uma campanha nova chamada "Cópia de …", em **rascunho**, com o mesmo modelo, as mesmas variáveis, a mesma mídia, o mesmo ritmo, o mesmo intervalo e o mesmo agente SDR.
   - Copia os mesmos destinatários, todos como pendentes. Contadores e histórico de envio não são copiados.
   - Nada é enviado: a cópia só começa a enviar quando você mandar iniciar.
3. **Excluir**:
   - Disponível para campanhas em rascunho, pausadas, concluídas ou canceladas. Para excluir uma campanha em envio, é preciso pausá-la antes.
   - Pede confirmação e avisa quantos destinatários serão removidos.
   - Remove a campanha e a lista de destinatários. As mensagens já enviadas continuam nas conversas da Inbox e nas fichas.
   - Se a sua permissão não permitir excluir, aparece um aviso claro, sem sucesso falso.

## Fora do escopo
Sem mudanças no banco ou nas permissões, que já cobrem excluir e criar dentro do workspace. Nenhuma campanha será iniciada e nenhuma mensagem será enviada nos testes.

## Validação
- Testes da regra: excluir é bloqueado quando a campanha está em envio; a cópia fica em rascunho, com os destinatários pendentes e os contadores zerados.
- Verificação de tipos, estilo, testes e versão de produção, com os resultados reais.
- Navegador em /campaigns/whatsapp: duplicar uma campanha de teste, conferir a cópia em rascunho, excluir a cópia e conferir que a original continua intacta.

## Detalhes técnicos
- Em `whatsapp-campaigns.functions.ts`, adicionar `duplicateWhatsAppCampaign` e `deleteWhatsAppCampaign` com `requireSupabaseAuth`. Elas usam o cliente do usuário (RLS) e o workspace ativo. As regras de status ficam em um helper puro (`campaign-actions.ts`), que também recebe os testes.
- A exclusão usa `deleteRowGuarded`: os destinatários primeiro e depois a campanha. Antes, recusa o status `running` no servidor.
- A cópia lê os destinatários em páginas de 1000 e grava em lotes de 500, como na criação.
- Na tela `campaigns.whatsapp.tsx`, acrescentar os botões Duplicar e Excluir, com `aria-label`, estado de carregamento e `confirmDialog`.
