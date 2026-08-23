---
title: Relatórios gerenciais (tipos e conteúdo)
aliases: [Reports, Relatórios, Generate reports]
tags: [behavioral, reports, financial, network, loan, status]
type: use-case
status: confirmed
source: "[[EV-2-g3-005 · Geração de relatórios|EV-2-g3-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Relatórios gerenciais (tipos e conteúdo)

O GLPI gera relatórios com base nos itens gerenciados (**Tools > Reports**). Complementa a nota de código/E1 [[Relatórios e estatísticas]] com os tipos de relatório embutidos.

## Tipos de relatório
- **Default report**: equipamentos por tipo; computadores também por SO.
- **By contract**: equipamentos sob contrato de manutenção (por tipo e data de compra); tabela com nome, lixeira, entidade, localização, datas de compra/garantia, tipo e datas do contrato.
- **By year**: como "by contract", mas inclui equipamentos **sem** contrato.
- **Hardware financial and administrative information**: resumo financeiro de computadores, impressoras, equipamentos de rede, monitores, periféricos e telefones; por período; com valor, valor contábil líquido, **TCO**, datas; totais por tipo e geral.
- **Other financial and administrative information**: idem, para **cartuchos, licenças e consumíveis**.
- **Network report**: por localização, por hardware ou por network plug.
- **Loan**: reservas atuais, futuras e passadas de um usuário.
- **Status**: resumo de status por tipo de equipamento.

> [!hint] Extensível por plugin
> O leque de relatórios pode ser ampliado pelo plugin *Reports* (plugins.glpi-project.org).

## Ver também
- [[Relatórios e estatísticas]] · [[Gestão Financeira de TI]] · [[Estatísticas do Service Desk (relatórios)]] · [[Reservar um equipamento (fluxo)]]
