# Despedida cordial nos prompts dos agentes

Porte P, de 15 a 25 minutos. A mudança vale só para o comportamento dos agentes, sem mexer em telas nem em regras do sistema.

## Situação atual
- A Lia (versão 19) e a Bruna (versão 3) publicadas não têm uma instrução de como se despedir. Elas só dizem que uma despedida do cliente não é pedido de descadastro e que o agente não deve se despedir automaticamente.
- Os roteiros de ligação "Lia — Ligação (piloto)" e "Bruna — Ligação (piloto)" falam de encerrar a chamada, mas não pedem cordialidade. O roteiro "Sofia" não fala de despedida.

## O que será feito
1. Acrescentar ao prompt da Lia e da Bruna (WhatsApp e e-mail) esta instrução: "Ao se despedir, seja sempre cordial. Agradeça pelo tempo e pela atenção, use o nome do cliente quando souber e deseje um bom dia, tarde ou noite conforme o horário. Deixe a porta aberta para um contato futuro, inclusive quando o cliente recusar ou pedir para não ser mais contatado. Nunca encerre de forma seca, ríspida ou com cobrança."
2. Publicar as novas versões: Lia v20 e Bruna v4. As versões anteriores serão arquivadas e poderão ser restauradas pelo histórico.
3. Acrescentar a mesma orientação, adaptada para a fala, aos três roteiros de ligação (Lia, Bruna e Sofia). Ela vai antes da regra que já existe de encerrar a chamada depois da despedida, que continua valendo.
4. Testar no simulador do agente uma recusa ("não tenho interesse, obrigado") e conferir se a resposta se despede com cordialidade.

## Fora do escopo
- Nenhuma mudança de código, de telas ou de permissões.
- As conversas em andamento passam a seguir a nova versão já no próximo turno.

## Detalhes técnicos
- Edição em `sdr_agent_versions.persona.instructions`: criar um novo rascunho a partir da versão publicada e publicar pela RPC `sdr_publish_agent_version`, o fluxo de sempre.
- Roteiros de ligação: acrescentar a frase em `prospecting_scripts.system_prompt`.
