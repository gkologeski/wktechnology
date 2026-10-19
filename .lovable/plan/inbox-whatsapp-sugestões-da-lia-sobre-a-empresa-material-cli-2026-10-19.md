# Inbox WhatsApp: sugestões da Lia sobre a empresa, material clicável e filtros preservados

## 1. Sugestão da Lia quando o cliente sai da empresa
Caso real: Juliano Ferreira escreveu "Nao trabalho mais na Alumisoft" e continua ligado à Alumisoft Sistemas.

**O que aparece na conversa**
- Um aviso da Lia dentro da conversa, entre as mensagens, com fundo colorido próprio e o selo "Sugestão da IA". O cliente nunca vê esse aviso.
- Texto: "Juliano informou que não trabalha mais na Alumisoft Sistemas."
- Botão **Desassociar da Alumisoft Sistemas**.
- Se o cliente disser o nome da nova empresa ("agora estou na Xpto"):
  - se a empresa já existe no workspace: botão **Trocar para Xpto**, que desassocia da antiga e associa à nova;
  - se não existe: botão **Criar Xpto e associar**, que cria a empresa só com o nome e associa o contato;
  - se o nome bater com mais de uma empresa: a pessoa escolhe qual na hora, nunca escolha automática.
- Também há os botões **Ignorar** e um link para abrir a ficha do contato.

**Regras**
- A troca de empresa nunca é automática: só acontece quando uma pessoa clica, com confirmação antes de aplicar.
- Só quem pode editar o contato (ou o lead) vê os botões ativos. Os outros veem o aviso sem os botões.
- Depois de aplicada ou ignorada, a sugestão fica registrada com quem fez e quando, e o aviso mostra esse resultado.
- A troca entra na linha do tempo do contato ("Empresa alterada de Alumisoft Sistemas para Xpto, a partir de sugestão da IA").
- Vale para Contatos e Leads. Se a conversa não estiver associada a ninguém, não aparece sugestão.
- Cada mensagem gera no máximo uma sugestão: mensagens repetidas não duplicam o aviso.
- Gera a sugestão para Juliano agora, a partir da mensagem que já existe, sem alterar o cadastro dele.

## 2. Material enviado pela Lia clicável na Inbox
Hoje a mensagem mostra "📎 Apresentação WK Technology" como texto. O arquivo chegou ao cliente no WhatsApp, mas na Inbox não dá para abrir.
- O nome do material passa a ser um link que abre ou baixa o arquivo.
- O link é gerado na hora do clique, curto e privado, só para quem pode ver a conversa. O arquivo continua fora do acesso público.
- Vale para as mensagens antigas também, incluindo os sete envios de hoje.
- Se o material tiver sido apagado, aparece "Material indisponível" em vez do link.

## 3. Filtros não resetam ao abrir uma conversa
Ao clicar numa conversa, a página trocava o endereço e perdia o filtro Abertas/Fechadas. Agora, ao abrir ou fechar uma conversa, os filtros são mantidos: situação, Minhas/Sem dono/Interagiu/Todas e busca.

## O que não muda
Nada é publicado, nenhuma mensagem é enviada e nenhum cadastro é alterado sem o clique de uma pessoa.

## Validação
- Testes com a frase real do Juliano e variações ("saí da X e fui para a Y", "agora estou na Y"), além de casos de controle ("saí da reunião", "o sistema saiu do ar").
- Testes da troca de empresa: empresa existente, empresa criada, nome ambíguo, ignorar e quem não tem permissão.
- Playwright: aviso na conversa do Juliano (sem aplicar a troca), link do material abrindo o PDF e filtros mantidos depois de clicar numa conversa.
- Checagem de tipos, lint, testes e build com resultados reais.

## Detalhes técnicos
- Nova tabela `inbox_ai_suggestions` (workspace_id, conversation_id, message_id, kind `company_left`, target entity/id, old_company_id, new_company_name, matched_company_ids, status pending/applied/dismissed, resolved_by/at, criada em). Unique `(message_id, kind)`. GRANT + RLS: leitura por quem vê a conversa (mesma regra de `whatsapp_conversations`), escrita só pelo servidor.
- Detecção: reutilizar `detectNotTarget`/`LEFT_RE` de `third-party.ts` e um novo `extractNewCompany` (padrões "agora estou/trabalho na X", "fui para a X"). Roda no ingest de mensagens recebidas, independente da Lia estar ligada.
- Aplicar a troca: server function com `requireSupabaseAuth`, permissão de editar o contato/lead pela RLS do usuário, criação da empresa pelo fluxo existente, registro na timeline, status da sugestão atualizado por compare-and-set (`status = 'pending'`).
- Inbox: o aviso entra na lista de mensagens ordenado por data, num componente próprio com token semântico de destaque da IA.
- Material: `raw.material_id` já está gravado. Nova server function `getSdrMaterialLink(messageId)` valida o acesso à conversa e devolve uma URL assinada curta do bucket `sdr-materials`, ou o link do material.
- Filtros: em `inbox.whatsapp.tsx`, trocar `navigate({ search: { conversation } })` e `navigate({ search: {} })` por atualizações que preservam `prev`. Levar o filtro de responsável para o endereço também.
