# CELULAR-5000: operação controlada no TechSales
A rotina é uma ação operacional manual, dentro do fluxo de Contatos; não cria agenda,
gatilho de prospecção, campanhas ou mudanças no enriquecimento geral. Sem configuração,
nenhuma chamada paga é liberada.

## Antes da publicação
- Validar a migration 0489 num clone isolado, comparar a numeração com a main
  atual e confirmar os checks de permissões, build e CI.
- Confirmar que nenhuma automação ativa de contatos responde ao preenchimento do
  celular com comunicação externa indesejada. Esta operação não envia mensagens.
- Conferir no Apollo do workspace WK licença, saldo e acesso de uma chave direta
  restrita aos endpoints People Enrichment e Poll Webhook Result. Não reutilizar
  a credencial do gateway Lovable.
- O responsável precisa confirmar o preço padrão aplicável: no máximo 9 créditos
  por tentativa, sem waterfall ou validação extra, e polling sem créditos. Se não
  for possível confirmar, não habilitar. Referências: [People Enrichment](https://docs.apollo.io/reference/people-enrichment)
  e [Poll Webhook Result](https://docs.apollo.io/reference/poll-webhook-result).
- Configuração privada do servidor: `APOLLO_MOBILE_5000_WORKSPACE_ID` para o workspace
  autorizado. Após validar o preço, definir `APOLLO_MOBILE_5000_VERIFIED_UNIT_MAX=9`
  e `APOLLO_MOBILE_5000_DIRECT_KEY` no gerenciador de segredos. Não copiar a chave
  para arquivo versionado, chat ou dispositivo de terceiros.

## Rodar após aprovação
1. Abrir Contatos > Celulares via Apollo e gerar a prévia sem chamadas ao Apollo.
2. Conferir critérios e saldo. Os candidatos dependem do porte registrado na
   empresa vinculada; porte sem piso comprovado, cargo ambíguo e identidade
   insuficiente não contam como elegíveis.
3. Aprovar explicitamente um lote piloto antes de liberar a base. Revisar
   amostra da correspondência e o uso real no Apollo, fora do total reservado.
4. Só então prosseguir dentro do orçamento. Uma sessão pode pausar entre tentativas;
   ao voltar, gerar a prévia de novo. Recuperar pendências não reenvia chamadas pagas.
5. Conferir o total atualizado, pendências, falhas e o gasto real no Apollo.
   Reservas com estado incerto não são reusadas nem reenviadas.
6. Para pausar novas chamadas, remover a confirmação de custo ou desabilitar a UI
   removendo o workspace configurado. Para revogar acesso ao provedor, remover a
   chave do servidor e revogá-la na Apollo. Não apagar a tabela para recuperar
   saldo. A trava é para uma campanha única e não reinicia com o ciclo da Apollo.
