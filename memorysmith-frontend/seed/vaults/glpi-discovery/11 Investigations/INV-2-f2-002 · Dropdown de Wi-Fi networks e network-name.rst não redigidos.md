---
title: INV-2-f2-002 · Dropdown de Wi-Fi networks e network-name.rst não redigidos
aliases: [INV-2-f2-002]
tags: [investigation, consumidor/cad, dropdown, internet, doc-gap]
type: investigation
status: open
maturity: seed
reviewed: false
author: CAD Discovery (doc)
created: 2026-07-12
---

# INV-2-f2-002 · Dropdown de Wi-Fi networks e network-name.rst não redigidos

> [!question] Seções incompletas na documentação
> Duas partes da documentação de dropdowns de internet estão explicitamente marcadas como pendentes:
> - Em `dropdowns/internet.rst`, a seção **"Wi-Fi networks"** contém apenas o texto **"TO BE DONE"**.
> - O arquivo `dropdowns/network-name.rst` contém apenas o título "Network Name" e a diretiva `.. todo:: This page must be redacted`.

## O que disparou
Cobertura integral da fatia de dropdowns de internet/rede. O conteúdo substantivo sobre network names está em `internet.rst` (seção "Network names"), enquanto `network-name.rst` permanece um stub.

## Impacto
- O comportamento e os campos de **Wi-Fi networks** como dropdown não estão documentados; não foi possível afirmar nada além da existência da seção.
- A modelagem de **network names** foi coberta a partir de `internet.rst` (ver [[Campos de rede IP e nome de rede]]); o arquivo dedicado não acrescenta informação.

## Próximos passos
- Complementar com a engenharia reversa do código de rede ([[Rede (portas, IP, VLAN)]]) para os campos de Wi-Fi networks.
- Reavaliar em versão futura da documentação oficial.
