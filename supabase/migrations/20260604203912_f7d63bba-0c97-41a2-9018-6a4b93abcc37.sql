UPDATE public.pipelines
SET stages = '[
  {"id":"1020709163","hubspot_id":"1020709163","value":"1020709163","label":"Stand by","order":0,"is_closed":false,"color":"var(--hs-stage-1)","probability":0,"type":"open"},
  {"id":"1016260620","hubspot_id":"1016260620","value":"1016260620","label":"Caixa de Entrada","order":1,"is_closed":false,"color":"var(--hs-stage-2)","probability":0,"type":"open"},
  {"id":"1016260621","hubspot_id":"1016260621","value":"1016260621","label":"Publicação da Vaga","order":2,"is_closed":false,"color":"var(--hs-stage-3)","probability":0,"type":"open"},
  {"id":"1016260622","hubspot_id":"1016260622","value":"1016260622","label":"Fazendo Hunting","order":3,"is_closed":false,"color":"var(--hs-stage-4)","probability":0,"type":"open"},
  {"id":"1016260623","hubspot_id":"1016260623","value":"1016260623","label":"Entrevista RH","order":4,"is_closed":false,"color":"var(--hs-stage-1)","probability":0,"type":"open"},
  {"id":"1209000238","hubspot_id":"1209000238","value":"1209000238","label":"Validação Comportamental","order":5,"is_closed":false,"color":"var(--hs-stage-2)","probability":0,"type":"open"},
  {"id":"1016260624","hubspot_id":"1016260624","value":"1016260624","label":"Teste Técnico","order":6,"is_closed":false,"color":"var(--hs-stage-3)","probability":0,"type":"open"},
  {"id":"1016260625","hubspot_id":"1016260625","value":"1016260625","label":"Entrevista Técnica","order":7,"is_closed":false,"color":"var(--hs-stage-4)","probability":0,"type":"open"},
  {"id":"1016260626","hubspot_id":"1016260626","value":"1016260626","label":"Perfil Enviado","order":8,"is_closed":false,"color":"var(--hs-stage-1)","probability":0,"type":"open"},
  {"id":"1016260627","hubspot_id":"1016260627","value":"1016260627","label":"Entrevista Cliente","order":9,"is_closed":false,"color":"var(--hs-stage-2)","probability":0,"type":"open"},
  {"id":"1016260628","hubspot_id":"1016260628","value":"1016260628","label":"Profissional Aprovado","order":10,"is_closed":false,"color":"var(--hs-stage-3)","probability":0,"type":"open"},
  {"id":"1062678138","hubspot_id":"1062678138","value":"1062678138","label":"Aceite do Profissional","order":11,"is_closed":false,"color":"var(--hs-stage-4)","probability":0,"type":"open"},
  {"id":"1099679559","hubspot_id":"1099679559","value":"1099679559","label":"Geração de Contrato","order":12,"is_closed":false,"color":"var(--hs-stage-1)","probability":0,"type":"open"},
  {"id":"1016260629","hubspot_id":"1016260629","value":"1016260629","label":"Profissional Contratado","order":13,"is_closed":true,"color":"var(--hs-stage-won)","probability":100,"type":"won"},
  {"id":"1016260630","hubspot_id":"1016260630","value":"1016260630","label":"Vaga Cancelada","order":14,"is_closed":true,"color":"var(--hs-stage-lost)","probability":0,"type":"lost"}
]'::jsonb
WHERE id = '3f126a3b-b421-4f67-a790-f2af166ce579';