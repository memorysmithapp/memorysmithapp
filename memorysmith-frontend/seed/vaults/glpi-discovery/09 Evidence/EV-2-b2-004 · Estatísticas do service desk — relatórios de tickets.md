---
title: EV-2-b2-004 · Estatísticas do service desk — relatórios de tickets
aliases: [EV-2-b2-004]
tags: [evidence, statistics, estatisticas, relatorios, service-desk]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/assistance/statistics.rst · Display statistics (documento inteiro)"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-b2-004 · Estatísticas do service desk — relatórios de tickets

> [!quote] Escopo
> "Statistics group reports on tickets as well as reports coming from plugins. Reports can be parameterized on a given time slot." (statistics.rst)

> [!quote] Tipos de relatório sobre tickets
> - **Global**: nº de tickets abertos, resolvidos, atrasados e fechados; tempo médio de processamento, resolução, fechamento e duração real; nº de pesquisas de satisfação (abertas/respondidas); satisfação média.
> - **By ticket**: estatísticas por item selecionado via dropdown (requester, técnico atribuído, impacto...). Tabela em quatro grupos: (1) nº abertos/resolvidos/atrasados/fechados; (2) pesquisas de satisfação abertas, respostas e média; (3) tempo médio de *Take into account* (entre abertura e primeira ação — follow-up, task ou solução), tempo de resolução ou de fechamento; (4) duração real do ticket (tempo alocado do técnico), média e total.
> - **By hardware characteristics**: estatísticas sobre computadores associados ao ticket (modelo, SO, placa-mãe...); mesmos números do relatório *By ticket*.
> - **By hardware**: nº de tickets atribuídos a cada hardware, ordenado por nº de tickets. (statistics.rst)

> [!quote] Gráficos e apresentação em árvore
> Botão por linha de resultado exibe estatística como gráfico; opção **See graphics** exibe como pizza (pie chart). Para itens em estrutura de árvore (grupos, categorias) há duas apresentações: **Normal** (todos os valores) e **Tree** (apenas valores do mesmo nível, considerando tickets anexados a elementos-filho; navegável). (statistics.rst)

## Sustenta
- [[Estatísticas do Service Desk (relatórios)]]
