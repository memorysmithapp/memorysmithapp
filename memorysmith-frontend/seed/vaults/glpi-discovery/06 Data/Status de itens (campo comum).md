---
title: Status de itens (campo comum)
aliases: [Status, Statuses of items, Status de itens]
tags: [campos-comuns, status, dropdown, data]
type: field
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-g4-007 · Campo Status de itens|EV-2-g4-007]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Status de itens (campo comum)

Campo comum ([[Dropdown (lista suspensa customizável)]]) que informa o **estado** de um item. Por padrão não há status; podem-se criar quantos se quiser, utilizáveis por regras. Gerenciável também em **Setup > Dropdowns > Common > Statuses of items**. Alguns plugins adicionam status (ex.: Uninstall).

Ao criar um status define-se: **Child entities** (ver [[Recursividade em entidades]]), **Name** (exibido na ficha), **Child of**, se o **item com esse status pode aparecer em assistência**, e a **visibilidade** por tipo de objeto (Computers, Monitors, Network devices, Phones, Printers, Licenses, Certificates, Racks, Contracts, além dos vários itens de componente — placa-mãe, firmware, processador, memória, disco, etc.).

> [!info] Ponte doc × código
> Visão específica deste campo em [[Status de itens (visão específica)]] (sessão 2 · E1).
