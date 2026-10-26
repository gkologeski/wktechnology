# Entrega com ciclos curtos

## Diagnóstico medido em 26/10/2026

O gate local anterior levou 37,6 s: permissões 0,8 s, tipos 18,4 s, lint 1,8 s e testes 16,7 s. O build separado levou 104,2 s. Estes valores são uma amostra local com cache; não representam a CI nem uma garantia de tempo. `verify` não executa build. O projeto usa Vitest: para teste direcionado, usar `bunx vitest run <arquivo>`, não `bun test`.

Foi reproduzido um fallback desnecessário: `.tscache/app.tsbuildinfo` não ignorado fazia `verify:changed` escolher lint e testes completos mesmo sem alteração no produto. O cache agora é ignorado pelo Git. Nenhuma proteção foi removida.

## Plano e ordem de implementação

| Pacote | Resultado                                                                                                 | Estado inicial          | Estimativa                           |
| ------ | --------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------ |
| 1      | Corrigir cache no seletor, medir loop, instruções proporcionais e Git como transporte                     | Implementação iniciada  | 30–50 min, incluindo validação local |
| 2      | Medir mudanças representativas em TechSales, TechPeople e infraestrutura; comparar loop e fechamento      | Planejado               | 20–40 min                            |
| 3      | Avaliar caches e cancelamento de CI obsoleta, preservando checks obrigatórios e evidência do commit exato | Planejado após medições | 30–60 min + execução remota          |
| 4      | Reduzir atrito de publicação: verificar escrita Git autenticada, sincronização e versão pública por hash  | Planejado               | 20–40 min; depende dos serviços      |

Não há meta percentual comprovada. Registrar tempo de edição, validação local, fila/execução CI e publicação separadamente. Recalibrar estimativas com essas medições, sem atribuir espera do provedor à implementação.

## Trabalho diário

1. Informar resultado esperado, escopo e estimativa. Preferir 2–5 arquivos por pacote funcional. Mais de 10 arquivos pede divisão lógica; não separar migração, contrato de permissão ou teste indispensável apenas para cumprir quantidade.
2. Editar e rodar `bun run verify:changed` para alterações não commitadas. Para commits já feitos usar `bun run verify:changed --base <SHA-base-do-pacote>`. A base padrão HEAD não cobre commits anteriores.
3. Para feedback ainda mais focal, usar `bunx vitest run <arquivo.test.ts>`. O loop já checa tipos: não adicionar outra execução de `typecheck:inc` por rotina. Essa alternativa só deve substituir o check de tipos em uma investigação medida, nunca o gate final.
4. Ler modo/motivo do seletor. Alterações de segurança, infraestrutura, arquivos removidos ou desconhecidos podem exigir fallback completo. Não alterar o seletor para esconder um risco.
5. Ao estabilizar o lote, executar `bun run verify`, `bun run build` e `bun run perf:check`. Rodar uma vez no fechamento; repetir se houver correção posterior que invalide a evidência. CI obrigatória continua independente e integral.
6. Enviar commits por Git/PR, esperar CI e sincronização do Lovable. Informar commit, objetivo e comandos; não pedir que o chat reconstrua um diff concluído. Se a integração recusar escrita, registrar o bloqueio e usar transporte autorizado; não apresentar tentativa como publicação.
7. Só declarar publicado após comparar `/build-info.json` com o hash validado e conferir o fluxo alterado. Não publicar a cada arquivo intermediário.

O loop grava `.verification/changed.json` com modo, motivos e tempos por etapa. `release_eligible: false` é permanente: esse arquivo não substitui `.verification/verify.json`, build, CI nem aceite. `--dry-run` apenas mostra o plano e não cria evidência de execução.

## Comunicação e contexto

Hotfix/P: resultado, testes, status de publicação e pendência material bastam; relatório extenso apenas quando necessário. M/G: plano, dependências, migração/rollback quando aplicável e evidências proporcionais. Ler o AGENTS raiz e os aplicáveis às pastas tocadas; preservar regras de domínio. Não remover requisitos de segurança para economizar contexto.

Não enviar tokens, dados de clientes ou logs privados ao repositório. Relatórios `.verification/` e caches são locais e ignorados. Manter estimativa inicial, tempo real e causa de desvios no registro de cada entrega.
