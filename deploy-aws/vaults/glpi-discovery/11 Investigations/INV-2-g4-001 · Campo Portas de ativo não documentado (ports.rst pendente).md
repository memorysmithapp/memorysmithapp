---
title: INV-2-g4-001 · Campo Portas de ativo não documentado (ports.rst pendente)
aliases: [INV-2-g4-001]
tags: [investigation, consumidor/cad, campos-comuns, portas, lacuna-doc]
type: investigation
maturity: seed
reviewed: false
source: "[[EV-2-g4-011 · Campo Portas sem redação na documentação|EV-2-g4-011]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# INV-2-g4-001 · Campo Portas de ativo não documentado

O arquivo `tabs/common_fields/ports.rst` da documentação oficial contém apenas o título "Ports" e um `.. todo:: This page must be redacted`. A semântica do campo comum **Portas** (o que representa na ficha de um ativo, valores, relação com portas de rede) não pode ser afirmada a partir da documentação.

> [!question] Dúvida em aberto
> O campo comum "Ports" descrito neste diretório refere-se às portas de rede (network ports) do ativo? Como se relaciona com a modelagem já mapeada no código em [[Rede (portas, IP, VLAN)]]?

> [!note] Encaminhamento
> A semântica provavelmente está coberta pela nota de código [[Rede (portas, IP, VLAN)]] (engenharia reversa do código, sessão 1). Confirmar por outra fonte (código ou redação futura da doc) antes de afirmar o comportamento do campo na interface.
