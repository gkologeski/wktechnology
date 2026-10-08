# Novos campos no Perfil de vaga

Quatro campos novos no perfil de vaga. Todos são opcionais e nenhum altera a aprovação.

## Campos
1. **Nível de escolaridade** (etapa Requisitos): você escolhe entre Ensino médio, Técnico, Superior em andamento, Superior completo, Pós-graduação/MBA, Mestrado e Doutorado. Também dá para marcar se é obrigatório ou desejável e escrever a área de formação (opcional).
2. **Competências comportamentais** (Requisitos): botões de atalho para comunicação, liderança, trabalho sob pressão, proatividade, trabalho em equipe e resolução de problemas. Também é possível digitar outras competências. Cada uma pode ser marcada como obrigatória ou desejável.
3. **Metodologias de trabalho** (Atuação): atalhos para Scrum, Kanban, Squads, SAFe, Cascata e DevOps, além de outras digitadas à mão.
4. **Benefícios** (Comercial › Hunting): botões para Plano de saúde, Plano odontológico, VR/VA, Ajuda de custo home office, Gympass/Wellhub, Seguro de vida, PLR e Auxílio educação. O campo de texto que já existe continua lá.

## Onde os campos aparecem
- No formulário de perfil, na ficha do perfil e na comparação entre versões.
- Na vaga enviada ao TechHire: escolaridade, competências e metodologias entram na descrição. Benefícios entram só se o cliente for de Hunting.
- No link do cliente: ele pode preencher escolaridade, competências e metodologias. Os benefícios ficam só para a equipe interna, junto da parte comercial.
- Na leitura por IA de documentos: a IA marca o campo como vazio quando a informação não aparece no documento e nunca inventa.

## Detalhes técnicos
- Os campos ficam no JSON atual de `data` do perfil, com padrão vazio. Por isso não é preciso migração e os perfis antigos continuam válidos.
- Arquivos: `src/lib/role-profiles/schema.ts` (zod, rótulos, diff, texto ATS, allowlist do cliente), `import.ts` (prompt e caminhos), `role-profile-wizard.tsx`, a ficha de detalhe e a página `/role-profile/$token`.
- Testes em `schema.test.ts`: o padrão vazio continua aceito, o diff detecta mudança de escolaridade, os benefícios não aparecem para o cliente e entram na vaga só quando o tipo é Hunting.
- Validação com Playwright: preencher os campos, salvar, reabrir e conferir o link do cliente.
