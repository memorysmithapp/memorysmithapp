---
title: Provenância dos campos de SO (comandos CLI por sistema)
aliases: [OS fields CLI, Comandos CLI de SO, OS provenance]
tags: [data, operating-system, cli, inventory, provenance]
type: entity
maturity: evergreen
reviewed: false
source: "[[EV-2-g3-019 · Aba Sistemas operacionais (campos e CLI)|EV-2-g3-019]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Provenância dos campos de SO (comandos CLI por sistema)

Origem técnica dos campos da [[Aba Sistema Operacional (ativos)|aba Operating system]]: a documentação lista, por campo, o comando CLI de onde o [[Inventário automático (processo)|inventário automático]] extrai o valor (também editável manualmente). Complementa [[Campos do Sistema Operacional (ativo)]].

| Campo | Windows | Linux | MAC |
|---|---|---|---|
| Name | `Get-CimInstance Win32_OperatingSystem \| Select Caption` | `cat /etc/issue` | hard-coded no agente GLPI |
| Architecture | `... Select OSArchitecture` | `uname -m` | `uname -m` |
| Kernel | `... Select Version` | `uname -r` | `uname -r` |
| Product ID | `... Select SerialNumber` | `/etc/sysconfig/rhn/systemid` | — |
| Company | `... Select organization` | — | — |
| Owner | `... Select registereduser` | — | — |
| Host ID | — | `hostid` | — |

> [!note] Campos adicionais
> **Version** (ex.: 22.04.4 LTS, 22H2), **Service pack** (geralmente Windows), **Edition** (agora indicada no name), **Serial number** (Client Product Key genérico da edição, não a licença do OS).

## Ver também
- [[Aba Sistema Operacional (ativos)]] · [[Campos do Sistema Operacional (ativo)]] · [[Inventário automático (processo)]]
