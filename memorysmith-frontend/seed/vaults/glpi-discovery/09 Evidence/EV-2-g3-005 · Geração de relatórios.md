---
title: EV-2-g3-005 · Geração de relatórios
aliases: [EV-2-g3-005]
tags: [evidence, tools, reports, financial, network, loan, status]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · source/modules/tools/reports.rst · Generate reports"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-g3-005 · Geração de relatórios

> [!quote] source/modules/tools/reports.rst — "Generate reports"
> GLPI gera relatórios com base nos itens gerenciados:
> - **Default report**: equipamentos presentes ordenados por tipo; computadores também por sistema operacional.
> - **By contract**: equipamentos sob contrato de manutenção com terceiro; detalhável por tipo e data de compra; seleção múltipla; tabela por tipo com nome, se está na lixeira, entidade, localização, datas de compra/expiração de garantia, tipo de contrato e datas de início/fim.
> - **By year**: como "by contract", mas também lista equipamentos **sem** contrato.
> - **Hardware financial and administrative information**: resumo financeiro de computadores, impressoras, equipamentos de rede, monitores, periféricos e telefones; por período; tabela com nome, entidade, valor, valor contábil líquido, **TCO**, datas de compra/início/garantia; totais por tipo e geral.
> - **Other financial and administrative information**: idem, mas para cartuchos, licenças e consumíveis.
> - **Network report**: três tipos — por localização, por hardware ou por network plug.
> - **Loan**: resumo de reservas atuais, futuras e passadas de um dado usuário.
> - **Status**: resumo dos diferentes status por tipo de equipamento.
> "The range of possible reports can be increased by adding to GLPI the following plugin: https://plugins.glpi-project.org/#/plugin/reports"

## Sustenta
- [[Relatórios gerenciais (tipos e conteúdo)]]
