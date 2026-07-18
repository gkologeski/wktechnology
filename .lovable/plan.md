## Problema

Três botões flutuantes se sobrepõem no canto inferior direito:

- **Copilot** (`AgentDrawer`): `fixed bottom-6 right-6`, 48px
- **Chat** (`ChatTrigger`): `fixed bottom-5 right-20`, 48px
- **Timesheet** (`TimerWidget`): `fixed bottom-4 right-4` — sobrepõe o Copilot

## Mudança

Reposicionar o `TimerWidget` para ficar **paralelo** aos demais, à esquerda do botão de Chat, mantendo alinhamento vertical consistente.

### Arquivo: `src/components/timer-widget.tsx` (linha 84)

Trocar:
```
<div className="fixed bottom-4 right-4 z-40" ...>
```
por:
```
<div className="fixed bottom-6 right-36 z-50" ...>
```

Layout final (direita → esquerda):

```text
[ Copilot right-6 ]  [ Chat right-20 ]  [ Timer right-36 ]
     24–72px            80–128px           144–192px
```

- `bottom-6` alinha com o Copilot (o `bottom-5` do Chat já é praticamente idêntico visualmente).
- `right-36` (144px) deixa 16px de gap após o Chat e evita colisão quando o Timer está em modo pílula (largura ~220px cresce para a esquerda, sem invadir o Chat).
- `z-50` iguala à camada dos demais.

Nenhuma alteração de comportamento, popover ou estilo interno do widget — apenas o wrapper de posicionamento.

## Fora do escopo

- Não mover Chat nem Copilot.
- Não alterar tamanho, ícones ou lógica do timer.
- Não criar dock/agrupador de botões flutuantes (pode ser proposto depois se desejado).

## Validação manual

1. Abrir qualquer rota autenticada.
2. Ver os três botões lado a lado, sem sobreposição, com o timer à esquerda do chat.
3. Iniciar um timer e confirmar que a pílula expandida não cobre o botão de Chat.
4. Testar em viewport ≥ 1024px e em mobile (todos usam `right/bottom` fixos, sem impacto de responsividade adicional).
