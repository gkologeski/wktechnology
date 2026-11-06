# Mostrar o texto do template no quadro "Variáveis do modelo"

Porte P · estimativa 30–45 min.

## O que muda
- Em cada quadro de template (principal e extras), acima das variáveis, aparece o texto do corpo do template, com as marcações {{1}}, {{2}}… destacadas.
- Se o template tiver cabeçalho/rodapé em texto, eles aparecem também, em tom mais discreto.
- Ao lado de cada variável, um trecho curto do texto onde ela aparece (ex.: "…TI na {{1}}…"), para entender o contexto ao escolher o campo.
- Vale também quando só existe o template principal (hoje o título nem aparece nesse caso).
- Só tela: nada muda em envio, regras, banco ou permissões.

## Detalhes técnicos
- `VariableGroup` em `campaign-audience-panel.tsx` ganha `body?: string` (e opcional `header`/`footer`).
- `campaigns.whatsapp.tsx` preenche esses campos a partir dos componentes do template já carregados na lista de templates (BODY/HEADER/FOOTER).
- Função pura para extrair o trecho em volta de `{{n}}` + renderização com destaque usando tokens semânticos.
- Teste unitário da função de trecho; validação no preview com Playwright no ICP 012 (sem salvar).
- Classificação de permissão: mudança só de apresentação (atualizar contrato/hash se exigido pelo `permissions:check`).
