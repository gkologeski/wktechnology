# Deals
- Painel de vendas calcula totais, listas e ranking (hot score) em RPCs invoker (`get_sales_dashboard_*`), devolvendo só o top-N; por quê: números exatos sem baixar milhares de linhas, e a fórmula SQL deve espelhar `computeHotScore` (teste de paridade).
