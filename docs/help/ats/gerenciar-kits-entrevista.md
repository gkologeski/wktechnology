---
module_key: ats
slug: gerenciar-kits-entrevista
title: Gerenciar kits de entrevista
summary: Montar conjuntos reutilizáveis de perguntas.
article_type: howto
route_pattern: /interview-kits
min_permission: techhire.interview_kits.view.own
audience: internal
sort_order: 30
version: 1
is_published: true
---
# Gerenciar kits de entrevista
**Para que serve:** Padronizar entrevistas.
**Quem pode fazer:** Ver exige `techhire.interview_kits.view`. Criar ou duplicar exige `.create`. Marcar padrão exige `.view.workspace` e `.update.workspace`. Editar e excluir dependem da permissão sobre o kit.
**Onde fica:** Menu > TechHire > Recrutamento > Kits de Entrevista (`/interview-kits`).
**Antes de começar:** Prepare as perguntas.

## Passo a passo
1. Clique em "Novo kit".
2. Preencha "Nome do kit" e marque "Kit padrão", se quiser.
3. Em "Perguntas", clique em "Adicionar". Escolha "Texto" ou "Vídeo".
4. No vídeo, informe o tempo em segundos.
5. Clique em "Salvar".
6. Use "Duplicar", "Desativar"/"Ativar" ou a lixeira na lista.
<!-- screenshot: kits de entrevista -->

## Resultado esperado
"Kit salvo".

## Regras e limites
- De 1 a 30 perguntas; cada uma até 2.000 caracteres.
- Vídeo: 15 a 600 segundos.
- Excluir pede confirmação: "Excluir este kit?".

## Erros comuns
- "Dê um nome ao kit": preencha o nome.
- "Preencha o texto de todas as perguntas": complete as perguntas.

## Relacionados
- [Gerenciar scorecards](/ajuda/ats/gerenciar-scorecards)
