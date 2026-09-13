---
title: Aba Conexões Diretas (ativos)
aliases: [Connections tab, Aba Conexões, Direct connections]
tags: [assets, tab, connections, computer, peripheral]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-2-c3-003 · Aba Conexões Diretas entre hardwares|EV-2-c3-003]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Aba **Connections**, que gerencia as **conexões diretas** entre um computador e seus elementos ligados — a relação entre hardwares vinculados física ou virtualmente.

> [!note] Cardinalidade conforme o lado
> - **A partir de um computador:** pode conectar-se a um ou vários elementos do tipo **display (monitor)**, **printer**, **peripheral** ou **phone**. Para cada objeto exibem-se nome, número de série e número de inventário.
> - **A partir de um não-computador** (ex.: monitor): a conexão é feita a um **único** computador, selecionado na lista suspensa; a tabela mostra o nome e os números de série/inventário desse computador.

A exclusão de uma conexão pode partir da entrada de qualquer hardware conectado (sua própria aba `Connections`) via [[Ações em massa (massive actions)]]. Adições/remoções ficam no histórico do computador e podem vir do [[Inventário automático (processo)]].

Ver também: [[Composição de um Ativo (componentes)]] · [[Modelo de Ativos (padrão comum)]].
