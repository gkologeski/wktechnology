# Módulos

- Contratos de módulo são testes estáticos em `src/lib/modules/module-contracts.test.ts` (domínios verticais sem imports cruzados; código do navegador sem `*.server` no topo); por quê: barrar regressão sem refatorar em massa.
