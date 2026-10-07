# Pesquisas

- Formulários de pesquisa usam só `form-schema.ts` (tipos, condições, validação, pontuação) e `FormRenderer`; por quê: construtor, timeline e servidor validam e pontuam igual.
- Respostas guardam `template_version` + `schema_snapshot`; por quê: editar/publicar nova versão não reinterpreta histórico.
- Pontuação é opt-in (pesquisa `scoringEnabled` + pergunta `scored`); sem pergunta pontuada elegível o score é `null`; por quê: nota ausente nunca vira zero ou reprovação.
- Importação com IA roda em `/api/surveys/import` (NDJSON) com SSRF/MIME/limites em `import/extract.ts`, idempotente por hash em `survey_imports`; por quê: documento é dado, não instrução, e nunca é guardado inteiro.
