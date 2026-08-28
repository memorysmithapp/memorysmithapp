---
title: EV-2-f2-006 · Dropdowns comuns localizações status fabricantes blacklists
aliases: [EV-2-f2-006]
tags: [evidence, dropdown, location, status, manufacturer, blacklist]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/configuration/dropdowns/general.rst"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-f2-006 · Dropdowns comuns localizações status fabricantes blacklists

> [!quote] general.rst — Locations
> A lista de **localizações** é organizada em árvore (Location 1 > Sub-location 1 > ...) e pode ser delegada por entidade. No registro há: localização pai, número do prédio, número da sala, coordenadas GPS (longitude, latitude, altitude), endereço. Se autorizado a usar a localização do usuário, o mapa exibido na criação mostra a localização aproximada para facilitar as coordenadas GPS. Abas: **Locations** (filhas), **Items** (itens com esta localização, filtrável por tipo), histórico, **tradução**, **Sockets** (sockets de rede da localização; adição única ou múltipla com prefixo/sufixo — ex. `bru09srv`, `bru10srv`, `bru11srv`).

> [!quote] general.rst — Status of items
> Lista de **status de itens** organizada em árvore (pode ter subníveis) e delegável por entidade. Aba Statuses of items (filhos), tradução, all.

> [!quote] general.rst — Manufacturers, Blacklists, Blacklisted email content
> **Manufacturers**: lista plana válida para todas as entidades; **não pode ser traduzida**. **Blacklists**: lista plana para todas as entidades; inclui o valor a colocar na blacklist e o tipo (IP, MAC, número de série, UUID ou e-mail); usada em importações automáticas via agente de inventário ou pelo receptor; não traduzível. **Blacklisted email content**: lista plana para todas as entidades; permite ao receptor não importar um e-mail contendo o texto definido (combate a spam quando há autorização de criação de ticket por e-mails anônimos); não traduzível.

## Sustenta
- [[Dropdowns gerais (localizações, status, fabricantes, blacklists)]]
- [[Campos de localização (dropdown)]]
