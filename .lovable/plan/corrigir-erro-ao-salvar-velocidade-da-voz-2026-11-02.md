# Corrigir erro ao salvar Velocidade da voz

Porte: P · Estimativa: ~15 min.

## Causa
O campo "Velocidade" aceita qualquer número digitado (ex.: 15, provavelmente vindo de "1,5" sem a vírgula). A tela não confere o limite e manda direto ao servidor, que recusa acima de 2 e devolve a mensagem técnica em inglês.

Além disso, a ElevenLabs só aceita velocidade entre 0,7 e 1,2 — o limite atual (0,5 a 2) deixaria passar valores que a voz não usa.

## O que muda
- Velocidade passa a ser um controle deslizante de 0,7 a 1,2 (passo 0,05), mostrando o valor ao lado (ex.: "1,00×"), sem como digitar valor inválido. Mesmo tratamento para Estabilidade e Similaridade (0 a 1).
- Servidor alinhado ao mesmo limite (0,7–1,2); valores antigos fora da faixa são ajustados ao carregar a tela.
- Erros de validação aparecem em português ("Velocidade deve ficar entre 0,7 e 1,2"), nunca o texto técnico.

## Observação
A "Mensagem de abertura padrão" atual contém palavrões; não vou alterá-la, mas recomendo trocar antes de qualquer ligação real.

## Detalhes técnicos
- `src/components/prospecting/pages/voice-agent-page.tsx`: trocar `Input type=number` por `Slider` (shadcn), clamp no carregamento, toast com mensagem traduzida de erros zod.
- `src/lib/voice-agent.functions.ts`: `speed: z.number().min(0.7).max(1.2)` com mensagem PT-BR.
- Atualizar hash do contrato em `permission-contracts.json`; rodar `permissions:check` e testar salvar no navegador.
