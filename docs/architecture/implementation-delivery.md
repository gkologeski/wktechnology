# Entrega com ciclos curtos

## Diagnóstico medido em 26/10/2026

O gate local anterior levou 37,6 s: permissões 0,8 s, tipos 18,4 s, lint 1,8 s e testes 16,7 s. O build separado levou 104,2 s. Estes valores são uma amostra local com cache; não representam a CI nem uma garantia de tempo. `verify` não executa build. O projeto usa Vitest: para teste direcionado, usar `bunx vitest run <arquivo>`, não `bun test`.

Foi reproduzido um fallback desnecessário: `.tscache/app.tsbuildinfo` não ignorado fazia `verify:changed` escolher lint e testes completos mesmo sem alteração no produto. O cache agora é ignorado pelo Git. Nenhuma proteção foi removida.

## Plano e ordem de implementação

| Pacote | Resultado                                                                                                 | Entrega de código | Estimativa                           |
| ------ | --------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------ |
| 1      | Corrigir cache no seletor, medir loop, instruções proporcionais e Git como transporte                     | Concluído         | 30–50 min, incluindo validação local |
| 2      | Medir mudanças representativas em TechSales, TechPeople e infraestrutura; comparar loop e fechamento      | Implementado      | 20–40 min                            |
| 3      | Avaliar caches e cancelamento de CI obsoleta, preservando checks obrigatórios e evidência do commit exato | Implementado      | 30–60 min + execução remota          |
| 4      | Reduzir atrito de publicação: verificar escrita Git autenticada, sincronização e versão pública por hash  | Implementado      | 20–40 min; depende dos serviços      |

Não há meta percentual comprovada. Registrar tempo de edição, validação local, fila/execução CI e publicação separadamente. Recalibrar estimativas com essas medições, sem atribuir espera do provedor à implementação.

## Trabalho diário

1. Informar resultado esperado, escopo e estimativa. Preferir 2–5 arquivos por pacote funcional. Mais de 10 arquivos pede divisão lógica; não separar migração, contrato de permissão ou teste indispensável apenas para cumprir quantidade.
2. Editar e rodar `bun run verify:changed` para alterações não commitadas. Para commits já feitos usar `bun run verify:changed --base <SHA-base-do-pacote>`. A base padrão HEAD não cobre commits anteriores.
3. Para feedback ainda mais focal, usar `bunx vitest run <arquivo.test.ts>`. O loop já checa tipos: não adicionar outra execução de `typecheck:inc` por rotina. A opção `typecheck:inc` continua disponível, mas as medições após edições mostraram regressões de cache. O loop usa `typecheck:dev`: binário nativo, projeto inteiro, `--incremental false`. O gate final permanece independente.
4. Ler modo/motivo do seletor. Alterações de segurança, infraestrutura, arquivos removidos ou desconhecidos podem exigir fallback completo. Não alterar o seletor para esconder um risco.
5. Ao estabilizar o lote, executar `bun run verify`, `bun run build` e `bun run perf:check`. Rodar uma vez no fechamento; repetir se houver correção posterior que invalide a evidência. CI obrigatória continua independente e integral.
6. Enviar commits por Git/PR, esperar CI e sincronização do Lovable. Informar commit, objetivo e comandos; não pedir que o chat reconstrua um diff concluído. Se a integração recusar escrita, registrar o bloqueio e usar transporte autorizado; não apresentar tentativa como publicação.
7. Só declarar publicado após comparar `/build-info.json` com o hash validado e conferir o fluxo alterado. Não publicar a cada arquivo intermediário.

O loop grava `.verification/changed.json` com modo, motivos e tempos por etapa. `release_eligible: false` é permanente: esse arquivo não substitui `.verification/verify.json`, build, CI nem aceite. `--dry-run` apenas mostra o plano e não cria evidência de execução.

## Comunicação e contexto

Hotfix/P: resultado, testes, status de publicação e pendência material bastam; relatório extenso apenas quando necessário. M/G: plano, dependências, migração/rollback quando aplicável e evidências proporcionais. Ler o AGENTS raiz e os aplicáveis às pastas tocadas; preservar regras de domínio. Não remover requisitos de segurança para economizar contexto.

Não enviar tokens, dados de clientes ou logs privados ao repositório. Relatórios `.verification/` e caches são locais e ignorados. Manter estimativa inicial, tempo real e causa de desvios no registro de cada entrega.

## Etapas 2–4

### Tipos e testes (etapa 2)

Comparação inicial com três execuções por comando: nativo sem cache 17,6–19,3 s; nativo incremental 18,0 s frio e 0,6–0,7 s sem alterações; tsc incremental 101,7 s frio e 3,4–4,8 s sem alterações. Os cenários posteriores com edições de TechSales, TechPeople e infraestrutura superaram 45 s em ambos os caches. O nativo completo concluiu em 18,2–32,4 s. Um erro de tipo temporário foi detectado pelos três modos e a remoção do erro foi reconhecida. Isso impede usar os números sem alterações como promessa de velocidade ao editar.

`typecheck:dev` chama diretamente o binário instalado do verificador nativo, com o projeto inteiro e sem cache incremental. `verify:changed` usa esse comando, seleciona lint e testes relacionados pelo grafo e continua caindo para validação ampla em infraestrutura/segurança. Alterações e erros temporários usados nos testes de invalidação são restaurados; os dados das medições ficam fora do produto. Os ciclos direcionados finais medidos em TechSales e TechPeople levaram 18,9 s cada; isso é feedback local, sem build, e não uma promessa de redução percentual do tempo total.

### CI (etapa 3)

- Grupo de concorrência separado por workflow, evento e PR/branch cancela versões substituídas. PR e main não se cancelam entre si.
- Cache apenas de downloads Bun (sistema, arquitetura, versão e lock) e de lint por conteúdo (lock/configuração/regras e commit).
- Instalação com lock congelado, permissões, checagem completa, todos os testes, build e limites de performance continuam incondicionais. Nenhum cache de resultado de autorização, `.verification/`, testes ou build é restaurado.
- Token da CI somente com leitura de conteúdo e checkout sem persistir credenciais. Não foi criado token adicional.

### Transporte e comprovação da publicação (etapa 4)

O acesso SSH existente de gkologeski autenticou e aceitou um envio de teste (`git push --dry-run`). A configuração local do repositório usa `remote.origin.pushurl=git@github.com:gkologeski/wktechnology.git`, preservando o endereço de leitura. Nenhuma chave foi copiada, criada ou enviada ao chat. Em clones novos, validar uma identidade SSH existente com `ssh -T git@github.com` e configurar o pushurl; se não existir, a autenticação deve ser feita pela pessoa no GitHub, sem credencial no prompt.

Fluxo repetível:

1. Estabilizar o pacote e executar o gate final; comitar.
2. `bun run delivery:prepare`: exige árvore limpa, verificação/build completos, limites de performance aprovados e correspondência com o código; testa o transporte por dry-run. O relatório marca `mode=prepared` e `published=false`.
3. `git push -u origin <branch>`, abrir PR, esperar CI, integrar e confirmar o SHA sincronizado no projeto WK do Lovable.
4. Publicar somente quando necessário e executar `bun run delivery:check --expected-commit <SHA-main>`. O comando verifica main, a mesma árvore Git validada e o hash servido nos dois domínios. O alias Lovable pode redirecionar para o domínio oficial: somente os dois endpoints HTTPS exatos são aceitos, com detecção de loop e limite de redirecionamentos; URLs externas, credenciais, outros caminhos e parâmetros são recusados. Divergência, erro HTTP, relatório parcial ou código alterado fazem o comando falhar.

`.verification/delivery.json` registra preparação ou comprovação de versão pública; não guarda tokens nem substitui o consentimento/autenticação do provedor. O SHA sincronizado no Lovable deve ser conferido pela integração autenticada. Não há requisição automática de nova publicação em `delivery:check`.

Referências: [cache incremental do TypeScript](https://www.typescriptlang.org/tsconfig/incremental.html), [concorrência da CI](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency), [cache de dependências e limites de acesso](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching).
