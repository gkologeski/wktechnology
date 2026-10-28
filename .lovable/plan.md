# Áudio da Meta + sugestão de desassociação pela IA

Porte: M · Estimativa: 45–60 min (código + testes + verificação). Sem publicar, sem enviar mensagens, sem alterar dados de clientes.

## 1. Transcrição de áudios recebidos pelo número Meta (Bruna)
Hoje a transcrição busca o áudio só pelo Conector Lovable; áudios do número Meta dão 404 e viram "não foi possível transcrever".

- A transcrição passa a buscar o áudio na mesma origem que já é usada para salvar a mídia: conexão Meta direta quando a mensagem veio por ela (`_cloud_phone_number_id`), Conector Lovable nos demais casos.
- Mesmos limites de tamanho, mesmos tratamentos de erro (falha definitiva grava aviso; erro temporário tenta de novo).
- Áudio já marcado como "não foi possível transcrever" (ex.: Marcelo Gomes) não é reprocessado automaticamente — fica para decisão sua.

## 2. Sugestão "saiu da empresa" complementada por IA (prompt, sem nova regra de texto)
As regras atuais continuam como estão. Quando elas não reconhecem nada, a IA do workspace analisa a mensagem recebida.

- Só roda se a conversa tem Contato/Lead com empresa associada (custo controlado).
- Prompt informa o nome da empresa atual do cadastro e pede um JSON: `{ saiu_ou_nao_pertence: boolean, nova_empresa: string|null, confianca: 0–1 }`. Instruções cobrem frases como "não sou da X", "não faço parte da X", "contato errado, não sou dessa empresa", "agora estou na Y"; ignora negações sobre outros assuntos.
- Gera sugestão apenas com confiança alta (≥ 0,7). Continua sendo só sugestão — nada muda no cadastro sem alguém aceitar.
- Falha/indisponibilidade da IA = nenhuma sugestão, sem bloquear o recebimento da mensagem.
- Uso via `aiChatFetch` (provedor configurado no workspace).

## Detalhes técnicos
- `src/lib/whatsapp/inbound-media.server.ts`: extrair resolução de mídia (cloud vs gateway) usada em `storeInboundMedia` e reutilizar em `ensureAudioTranscripts`.
- `src/lib/inbox/ai-suggestions.server.ts`: fallback `classifyCompanyLeftWithAI` (novo módulo puro de prompt/parse em `src/lib/inbox/company-left-ai.ts`) após `detectCompanyLeft` retornar null.
- Testes: parse/limiar do classificador (mock de IA), escolha de origem do áudio (Meta vs Lovable).
- Validação: testes afetados, lint, typecheck (reportar resultado real), `permissions:check` com contratos/hash atualizados.
- Sem migrations, sem mudança de RLS/permissões.
