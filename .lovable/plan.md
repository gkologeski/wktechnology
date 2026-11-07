# Corrigir erro "O substatus pertence a outro pipeline" no Lead

## Causa (confirmada no banco)
O lead Alan Fuentes não tem funil nem etapa gravados (só o status antigo "contacted"). A tela mostra "2. Em Contato" porque deduz a etapa pelo status, mas ao salvar o substatus envia apenas o substatus. A regra do banco compara o funil do substatus com o funil do lead (vazio) e recusa. Outros 91 leads do workspace WK estão na mesma situação.

## O que será feito
1. **Ficha do lead**: ao escolher um substatus, gravar junto o funil padrão de leads e a etapa que a tela já exibe, quando o lead ainda não os tiver. A regra do banco continua igual.
2. **Lista de leads** (seletor rápido de substatus): mesma correção, caso use o mesmo caminho.
3. **Preencher os 91 leads antigos**: completar funil e etapa a partir do status atual, sem mudar a etapa visível, substatus ou responsáveis. Faço isso só se você aprovar, com checagem antes e depois.
4. **Teste**: um teste para a regra "lead sem funil recebe funil e etapa ao definir substatus". Depois, abro o Alan Fuentes no navegador, defino "Contato Estabelecido" e confiro que salva.

## Estimativa
Porte P, entre 30 e 45 minutos. Depende apenas da sua aprovação do item 3.

## Detalhes técnicos
- `src/routes/_authenticated/leads.$id.tsx` `setSubstatus`: incluir `pipeline_id: pipelineId` e `stage_id: currentStageValue` quando `lead.pipeline_id`/`stage_id` forem nulos. O gatilho `sync_stage_substatus` só zera o substatus quando o `stage_id` muda e o substatus não muda; como os dois mudam no mesmo update, o substatus escolhido é mantido.
- Revisar `src/components/pipelines/substatus-quick-picker.tsx` e `leads.tsx`.
- Backfill: migration com UPDATE usando o mapa status→etapa do funil padrão de leads. Permissões e RLS não mudam.
