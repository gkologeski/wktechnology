# Pesquisas: construtor, pontuação opcional e importação com IA

## Rotas
- `/surveys` (e `/settings/surveys`): botões "Importar pesquisa com IA", "Nova no construtor"; aba Livre tem "Construtor" por linha.
- `/survey-builder/$id`: construtor (Construir · Configurações · Pré-visualizar).
- `POST /api/surveys/import`: importação autenticada, resposta NDJSON com progresso.

## Tipos de campo
Texto curto/longo, número, moeda, e-mail, telefone, URL, data, data e hora, escolha única, múltipla, lista suspensa, sim/não, escala linear, estrelas, NPS, matriz/Likert, upload, título de seção, descrição, nova página.
Propriedades: enunciado, descrição, placeholder, obrigatória, largura, limite de caracteres, mín/máx, rótulos de escala, estrelas, opções/linhas, pontuar + peso + pontos por opção, condição E/OU (só campos anteriores — evita ciclos).

## Semântica de pontuação
- Pesquisa nova: sem pontuação. Número/escala não gera nota sozinho.
- Só soma pergunta `scored` em pesquisa com pontuação ligada.
- Pontuada oculta por condição: fora da soma e do máximo. Visível sem resposta: entra no máximo com 0.
- Nenhuma pergunta elegível: `score = null` (nunca 0/reprovado).
- Questionários de vendas existentes continuam pontuados (`scoring_enabled` padrão `true`). Desligado: score nulo, painel mostra "Sem pontuação · Decisão manual".
- CSAT/NPS de ticket (legado) mantêm a nota; "Respondidas" agora conta pela data de resposta, não pela nota.

## Versões
Salvar = rascunho com revisão (conflito detectado). Publicar = nova versão imutável em `survey_template_versions` + sincroniza `survey_template_questions`. Publicar não envia nada.

## Importação
Limites: arquivo 10 MB (PDF, DOCX, PNG, JPG, WebP, validado por assinatura); HTML público 2 MB, 15 s, até 3 redirecionamentos rechecados; bloqueia localhost/IP privado/portas/credenciais na URL; PDF com senha recusado; DOCX lê só `word/document.xml` com teto (ZIP bomb). Leitura pela IA do workspace (`aiChatFetch`, modelo multimodal para PDF/imagem). Documento não é armazenado; guarda-se hash + estrutura. Mesmo conteúdo reaproveita a leitura anterior.

## Pendências conhecidas
- Página pública para pesquisas livres (link por token) com o mesmo renderer: não implementada.
- Upload de arquivo como resposta: campo existe; armazenamento da resposta-arquivo ainda não ligado (aparece desabilitado com aviso).
- PDF escaneado, imagem e URL: caminho implementado; testado de verdade apenas DOCX.
