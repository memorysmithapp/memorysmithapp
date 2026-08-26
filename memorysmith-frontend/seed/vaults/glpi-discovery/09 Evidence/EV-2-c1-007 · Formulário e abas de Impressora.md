---
title: EV-2-c1-007 · Formulário e abas de Impressora
aliases: [EV-2-c1-007]
tags: [evidence, assets, printer, snmp, doc]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/assets/printers.rst · Printers (todas as seções/abas)"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-c1-007 · Formulário e abas de Impressora

> [!quote] modules/assets/printers.rst
> "Printers can be brought up via SNMP discovery or manually. Certain information such as ink level or page counter can be fed in." (depende do fabricante e da informação que a impressora consegue retornar).

**Campos do formulário de Impressora:** Name; Location; Technician in charge; Group in charge; Alternate username number; Alternate username; **Sysdescr**; User; Group; Comments; Status; Printer type; Manufacturer; Model; Serial number; Inventory number; **SNMP Credentials**; **Management type**; Network; UUID; Update source; **Memory**.

> [!note] Templates: "It is possible to use templates with printers."

**Abas:** Impact Analysis; Operating systems; Software; **Cartridges** (cartuchos de tinta via SNMP ou manual; nível de tinta se reportado pelo inventário); **Page counters** (contadores de impressão, se o fabricante permitir; filtro por 7/30 dias, ano; visão diária/semanal; comparação com outra impressora); Components; Lines; Volumes; Connections; Network Ports; Sockets; Management; Contracts; Documents; Knowledge Base; Tickets; Problems; Changes; Projects; Links; Notes; Reservations; Certificates; Locks; Domains; Appliances; Historical; All.

> [!tip] Inventário SNMP de impressoras: procedimento em `https://faq.teclib.com/03_knowledgebase/inventory/snmp_inventory/`.

## Sustenta
- [[Campos do formulário de Impressora]]
- [[Campos comuns de um ativo (formulário)]]
- [[Contadores de página e cartuchos da impressora]]
- [[Abas comuns de um ativo (visão do usuário)]]
</content>
