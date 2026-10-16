# Inbox WhatsApp: cabeçalho compacto, caixa de mensagem maior e leitura de anexos

## O que foi confirmado
- "[document]" é o cliente enviando um arquivo (PDF, Word, etc.). Hoje o recebimento grava só o tipo entre colchetes (`webhook-processor.server.ts`, linha 70) e não baixa o arquivo. Por isso nada abre. O mesmo vale para imagem, áudio, vídeo, figurinha, localização e contato.
- A tela já sabe exibir imagem, áudio, vídeo e PDF quando a mensagem tem arquivo salvo; falta o recebimento salvar.

## O que será feito
1. **Cabeçalho menor**: título "Inbox WhatsApp", descrição e abas em uma faixa compacta (título menor, sem descrição em telas baixas, abas na mesma linha), liberando altura para as mensagens.
2. **Caixa de mensagem maior**: altura inicial de cerca de 3 linhas, crescendo com o texto até ~10 linhas, com rolagem própria depois disso.
3. **Receber qualquer tipo de conteúdo**:
   - Imagem, vídeo, áudio (inclusive mensagem de voz), documento e figurinha: baixar o arquivo do WhatsApp no servidor (limite de 16 MB, leitura controlada), guardar no armazenamento privado da empresa e vincular à mensagem. Se falhar, a mensagem fica pendente e é tentada de novo.
   - Mostrar na conversa: imagem e figurinha em miniatura, player de áudio/vídeo, documento com nome do arquivo e botão para abrir/baixar. Legenda aparece abaixo.
   - Localização: nome/endereço e link para o mapa. Contato compartilhado: nome e telefone. Reação: emoji indicado. Links no texto ficam clicáveis.
   - Lista de conversas mostra "📎 Documento: nome.pdf", "🖼 Imagem", "🎤 Áudio" em vez de "[document]".
4. **Histórico**: reprocessar as mensagens já recebidas com anexo na WK (somente leitura do WhatsApp; nada é enviado). Arquivos com mais de 30 dias podem não estar mais disponíveis na Meta; esses ficam marcados como "arquivo indisponível".
5. **Lia**: recebe uma descrição do anexo ("cliente enviou documento X") em vez de "[document]".

Fora do escopo: ler o conteúdo interno de documentos/áudios com IA (transcrição/resumo) — pode ser um próximo passo.

## Validação
- Testes para a conversão de cada tipo de mensagem em texto de exibição e para o limite de tamanho.
- Typecheck, lint e build.
- Playwright em `/inbox/whatsapp` em 1183x653: cabeçalho compacto, caixa maior, documento da conversa +55 43 98837-7544 abrindo.

## Detalhes técnicos
- Webhook: guardar `media_id`, `mime_type`, `filename`; download via gateway (`/media/<id>` → `/media_download` com `X-WhatsApp-Media-URL`), leitura por stream com corte em 16 MB; upload em bucket privado existente de mídia WhatsApp e `media_url`/`media_content_type` na mensagem (URL assinada na leitura). Coluna aditiva `media_filename` se não existir.
- `WhatsAppMediaBubble`: novo caso documento com nome; links com `target=_blank rel=noreferrer`.
- Layout: ajuste do cabeçalho no casco da Inbox apenas para a rota WhatsApp (ou opção `compact`), textarea com `min-h`/`max-h` + auto-crescimento.
