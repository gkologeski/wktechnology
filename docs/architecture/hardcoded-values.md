# Valores fixos: onde colocar e como externalizar

A verificação `src/lib/hardcode-guard.test.ts` roda em `bun run test` (e no CI) e bloqueia:

- identificadores do projeto e URLs de preview no código;
- credenciais literais (chaves de API, chaves privadas);
- domínios próprios fora de `scripts/hardcode-guard/domain-allowlist.json`;
- aumento de cores avulsas (`bg-white`, `text-black`, `bg-[#...]`) além de `scripts/hardcode-guard/color-baseline.json`.

## Fontes canônicas

| Tipo                                      | Arquivo                                             |
| ----------------------------------------- | --------------------------------------------------- |
| Domínios, hosts, OAuth, remetente         | `src/lib/platform-domains.ts`                       |
| Origem pública em runtime, mocks internos | `src/lib/runtime-config.server.ts`                  |
| Fuso padrão                               | `src/lib/time-zone.ts`                              |
| Quotas, paginação, lotes                  | `src/lib/limits.ts`                                 |
| Cor neutra persistida                     | `src/lib/ui/default-colors.ts`                      |
| Cargos padrão (por nome estável)          | `src/lib/access-control/default-job-role.server.ts` |

## Regras

1. Constante legítima (protocolo, enum, limite oficial de provedor) fica junto do seu domínio, com comentário explicando a origem.
2. Valor que varia por ambiente: variável de ambiente lida dentro do `.handler()`; segredos nunca com prefixo `VITE_`.
3. Valor que varia por workspace: persistido no banco (exige migration aprovada).
4. Cores de interface: tokens de `src/styles.css`. Só reduza o baseline; nunca aumente sem justificar no PR.
5. Novo arquivo com domínio próprio: prefira importar de `platform-domains.ts`; se for texto legal/público, adicione à allowlist no mesmo PR.
