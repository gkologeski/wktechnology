# Erro ao voltar do editor de workflow

## Diagnóstico

O HTML colado ("This page didn't load") não é uma tela do TechERP: é a página de erro do
ambiente de preview, exibida quando o servidor do preview não responde à requisição.

O que foi verificado agora:

- O botão "<" do editor (`WorkflowBuilder`) apenas fecha o diálogo (`onClose` -> `setDraft(null)`).
  Não há navegação, `useNavigate`, `location.href` nem chamada de servidor nesse clique.
- Teste automatizado no navegador contra o app rodando: abrir `/settings/workflows`, entrar na
  edição de um workflow e clicar em "Voltar" retorna à lista normalmente — sem erro de página,
  sem erro de console e sem erro de runtime.
- O log do servidor de desenvolvimento mostra que ele reiniciou exatamente na janela em que o erro
  apareceu (`.env.development changed, restarting server...` e saída do processo com código 143).
  Durante esse intervalo qualquer requisição do preview falha e o preview mostra essa mesma página.
- Os logs do site publicado da última hora não registram nenhuma falha 5xx em requisição de página.

Conclusão: a evidência aponta para indisponibilidade momentânea do preview durante um reinício,
não para um defeito no botão "<". Não há, no momento, nenhuma reprodução do erro no código.

## Proposta

Fase 1 — Confirmar (sem alterar código)

- Recarregar o preview e repetir o fluxo: abrir workflow -> editar -> clicar em "<".
- Se o erro voltar, capturar a URL da barra de endereço no momento da falha e se ele ocorre também
  no domínio publicado (`app.wktechnology.com.br`), para separar preview de produção.

Fase 2 — Endurecer o retorno (apenas se o erro se repetir, ou se você quiser já de saída)

- Ao fechar o editor, revalidar a lista de workflows via React Query em vez de depender do estado
  atual da tela, evitando lista desatualizada após sair da edição.
- Confirmação de saída quando houver alterações não salvas no rascunho, para o "<" não descartar
  trabalho silenciosamente.
- Nenhuma mudança de schema, RLS, engine de workflow ou regra de negócio.

## Detalhes técnicos

- Arquivos envolvidos na Fase 2: `src/components/workflows/workflow-builder.tsx` (handler do botão
  "Voltar") e `src/routes/_authenticated/settings.workflows.tsx` (`onClose` do `WorkflowBuilder`).
- A revalidação usaria o `queryClient` já existente na rota; a confirmação usaria o
  `confirmDialog` já em uso no arquivo.
- Validações previstas: `tsgo --noEmit`, `eslint`, testes de `src/lib/workflows` e reprodução do
  fluxo no navegador.
