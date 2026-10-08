# Corrigir erro ao salvar ou solicitar validação em "Vagas e perfis"

## O que já foi verificado
- A tela mostra "1 perfil(is) não foram salvos. Os demais foram salvos." Esse aviso é genérico: o motivo real de cada perfil fica escondido.
- No banco existe só um perfil nesse negócio, o "Desenvolvedor Python Senior", já aprovado. O perfil que você está editando ("nada a declarar") nunca foi gravado.
- As permissões de gravação, inclusive as três corrigidas antes, estão certas. A regra interna de proteção do perfil também não bloqueia a criação de um rascunho.
- **A causa exata ainda não está confirmada.** As suspeitas são a validação de algum campo do formulário ou a checagem do cargo/preset escolhido no título.

## Passos
1. **Reproduzir:** abrir o negócio no navegador com sua sessão, repetir os cliques ("Salvar rascunhos", "Solicitar validação", "Adicionar cargos", "Duplicar") e capturar a mensagem que o servidor devolve. O perfil de teste criado será removido depois.
2. **Corrigir a causa encontrada** (campo recusado, vínculo de cargo/preset ou outra permissão), sem mudar as regras de aprovação.
3. **Melhorar o aviso:**
   - mostrar o motivo real em cada perfil, junto do campo com problema;
   - deixar de dizer "Os demais foram salvos" quando não há outros perfis;
   - exibir erros de validação em português, nunca um texto técnico.
4. **Teste automático** do caso que falhou, com valores como "nada a declarar", 3 meses, 40 horas e uma etapa de entrevista.
5. **Verificar de novo no navegador:** salvar, reabrir sem duplicar e solicitar validação. Remover os perfis de teste.

## Detalhes técnicos
- Criação: `createProfile` em `src/lib/role-profiles/service.server.ts` (`validateLinks`, `dealEligibility`, `ProfileHeaderZ`/`ProfileDataZ`).
- Aviso: `role-profiles-editor.tsx`, por volta da linha 255. Hoje ele usa `(e as Error).message`, que pode ser JSON do Zod.
