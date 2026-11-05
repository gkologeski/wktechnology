---
module_key: crm
slug: consultar-reunioes
title: Consultar reuniões
summary: Localizar reuniões e consultar detalhes, gravações e transcrições disponíveis.
article_type: howto
route_pattern: /meetings
min_permission:
audience: internal
sort_order: 210
version: 2
is_published: true
---
# Consultar reuniões
**Para que serve:** Consultar a biblioteca de reuniões e os materiais de cada encontro.
**Quem pode fazer:** Membros ativos com TechSales licenciado e acesso às reuniões (`techsales.meetings`); criar também pode exigir `techsales.activities`.
**Onde fica:** Menu > TechSales > Reuniões (`/meetings`).
**Antes de começar:** Confira se está no workspace correto.

## Passo a passo
1. Abra "Reuniões".
2. Use a busca, o filtro de status e o filtro de responsável.
3. Abra uma reunião.
4. Confira "Participantes" e, quando houver, "Gravação" e "Resumo & transcrição".
5. Confira os encaminhamentos em "Action items".
6. Para iniciar um encontro, clique em "Vídeo". Na janela "Iniciar reunião por vídeo", preencha "Título", marque ou desmarque "Permitir gravação" e clique em "Criar e abrir sala". O Jitsi pede o consentimento dos participantes ao iniciar a gravação.
<!-- screenshot: biblioteca de reuniões e detalhe com Gravação, Resumo & transcrição e Participantes -->

## Resultado esperado
A reunião mostra seus dados e os materiais disponíveis.

## Regras e limites
- Nem toda reunião tem gravação ou transcrição; isso não é erro.
- A gravação precisa pertencer à reunião e ao workspace ativo.
- Ver, alterar, excluir e transcrever dependem de autorização.
- No detalhe da reunião, "Enviar gravação" (ou "Substituir gravação") anexa o arquivo, e "Criar tarefas" gera tarefas a partir da reunião.

## Erros comuns
- "Reunião não encontrada": confira o registro e seu acesso.
- "Não foi possível criar a sala da reunião. Tente novamente.": tente iniciar de novo.
- "Sem gravação para transcrever": envie a gravação antes.
- "Gravação fora da reunião autorizada.": peça verificação do vínculo.
- "LOVABLE_API_KEY não configurada": peça ao administrador para conferir a transcrição.

## Relacionados
- [Organizar tarefas](/ajuda/crm/organizar-tarefas)
- [Erros comuns](/ajuda/crm/erros-comuns)
