# Diagnóstico somente leitura — tarefas 7 (limite de 240 s) e 8 (fase Nitro)

## O que já existe hoje (lido agora, sem alterar nada)

| Item | Evidência | Tipo |
|---|---|---|
| Registro da plataforma "typecheck encerrado após 240 s" (13:47:12 UTC) | citado em `docs/architecture/executed-tasks-closure.md` linhas 17 e 144-156. O arquivo original `/tmp/observability/build-errors.log` **não existe mais** nesta sessão (a pasta `/tmp/observability` está ausente) | registro indireto; o original não pode ser conferido agora |
| Comando exato que a plataforma roda | não aparece em nenhum arquivo ou registro acessível | **desconhecido** |
| `tsc --noEmit` com memória padrão (3,2 GB) | morre por falta de memória após 2:14 | medido (ciclo anterior) |
| `tsc --noEmit` com 8 GB | 1:55, usa 5,1 GB, 13,5 mi instanciações | medido |
| `bun run typecheck` = `tsgo --noEmit` (`package.json` linha 14) | termina dentro do `verify` com saída 0 | medido |
| `bun run build` = `vite build` com 8 GB (`package.json` linha 8) | client 36,1 s · ssr 41,1 s · fase worker 53,3 s · total 2:13,5 · pico 7,3 GB | medido, uma única execução |
| "Nitro" | em `vite.config.ts` a 3ª fase vem do `@cloudflare/vite-plugin` (ambiente `cloudflare-module`, só no build), não de um passo Nitro separado | lido no código |

**Conclusão atual:** é compatível com o limite de 240 s da **ferramenta de verificação**, e não com o build, que termina em cerca de 134 s. A hipótese é um `tsc` com pouca memória. Não está provado qual comando a plataforma roda. Não há medição de onde o tempo é gasto **dentro** da fase worker.

## O que o diagnóstico vai executar (tudo em cópia em /tmp, sem tocar no projeto)

1. **Recuperar registros:** procurar em `/tmp/exec-logs/`, `/tmp/dev-server-logs/dev-server.log` e em qualquer registro da plataforma que estiver disponível as entradas com "240", "timed out" e "typecheck", com data e hora. Se nada aparecer, registrar que o original se perdeu.
2. **Reproduzir o limite:** em `/tmp/diag-copy` (cópia do código com o `bun.lock` original e instalação limpa), rodar com `timeout 240` e `/usr/bin/time -v`, um comando por vez:
   - `tsc --noEmit` com a memória padrão;
   - `tsc --noEmit` com 8 GB;
   - `tsgo --noEmit` com o cache desligado;
   - `vite build`.

   Para cada um, registrar se estourou os 240 s, quanto durou e quanta memória usou. Isso responde se o limite é da ferramenta ou do build.
3. **Perfil da fase worker:** build com `DEBUG=vite:*`, `--profile` (cpuprofile do Node) e marcação de tempo por ambiente. Resumir o tempo por plugin e o top-20 de módulos mais caros (transform e tree-shake) a partir do perfil, além do tempo de minificação e de escrita.
4. **Relatório:** atualizar só a seção dos IDs 7 e 8 em `docs/architecture/executed-tasks-closure.md` (é a única escrita), com colunas Medido / Hipótese / Caminho do registro. Os IDs 7 e 8 só fecham se as medições do passo 2 e o perfil do passo 3 existirem.

## Fora de escopo

Alterar código ou configuração do app, migrações, publicação, mensagens a clientes, aumentar o limite de tempo ou desligar verificações.

## Detalhes técnicos

- A cópia usa `rsync` sem `node_modules`/`dist`/`.tscache`, e depois `bun install --frozen-lockfile`.
- Execuções sequenciais, nunca builds simultâneos.
- O perfil é gravado em `/tmp/diag-copy/prof/*.cpuprofile` e lido com um script Python que soma o tempo próprio por arquivo de `node_modules` e de `src`.
