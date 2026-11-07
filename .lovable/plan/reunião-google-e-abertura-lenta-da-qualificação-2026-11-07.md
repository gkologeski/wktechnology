# Reunião (Google) e abertura lenta da qualificação

Porte: P/M — estimativa 1h30–2h30.

## 1. Erro "Sincronização Google falhou: Falha ao renovar token: 400"

Diagnóstico confirmado: a conta Google ligada à agenda mais recente responde ao Google com `invalid_grant — Account has been deleted`. A conta foi excluída ou o acesso foi revogado no Google. Não é falha do sistema; a reunião foi salva normalmente.

O que fazer:
- Mensagem amigável no toast: "Reunião salva. A agenda Google desconectou (conta removida ou acesso revogado). Reconecte em Configurações → Calendário." com botão "Reconectar".
- Ao receber `invalid_grant`, marcar a conta como desconectada (para de tentar renovar a cada 2 min e para de gerar erro em todas as reuniões), mostrando o aviso na tela de Calendário.
- Ação sua: reconectar a agenda Google (ou remover a conta antiga) em Configurações → Calendário.

## 2. Janela de qualificação demorando

Hoje a janela só abre depois que a mudança de etapa termina de gravar no banco (com todos os gatilhos do lead). Depois disso ela ainda carrega questionário e campos.

O que fazer:
- Abrir a janela no clique, antes da gravação (gravação segue em segundo plano; se falhar, a janela fecha e aparece o erro).
- Pré-carregar questionário e layout de campos quando a ficha do lead abre, para a janela já aparecer preenchida.
- Medir com Playwright cada etapa (gravação da etapa, carga do questionário, campos, pesquisa pendente) e rodar EXPLAIN nas consultas lentas; criar índices só onde o plano mostrar varredura cara (migration nova, sem alterar regras de acesso).
- Validar no navegador: janela visível em menos de 300 ms após o clique.

## Detalhes técnicos
- `src/lib/calendar/engine.server.ts` `refreshAccessToken`: detectar `invalid_grant` → `last_status='disconnected'`, erro tipado; engines de reunião/booking traduzem a mensagem.
- `src/routes/_authenticated/leads.$id.tsx`: `setSurveyOpen(true)` antes do `update`; rollback no erro.
- `SurveyActivityDialog`/`qualification-panel`: `queryClient.prefetchQuery` dos dados do questionário.
- Índices via migration nova após EXPLAIN; contrato de permissão atualizado; `permissions:check` e testes.
- Sem publicação até você pedir.
