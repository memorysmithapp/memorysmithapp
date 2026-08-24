---
title: Campos do Antivírus (ativo)
aliases: [Antivirus fields]
tags: [data, assets, antivirus, fields]
type: entity
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-c3-001 · Aba Antivírus de um Computador|EV-2-c3-001]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Atributos de um antivírus registrados na [[Aba Antivírus (ativos)|aba Antivírus]] de um `Computer`:

| Campo | Semântica |
|---|---|
| Name | Nome do produto antivírus |
| Automatic inventory | Indica se o registro veio do inventário automático |
| Manufacturer | Fabricante (cadastro comum — [[Fornecedores e Contatos]]) |
| Antivirus version | Versão do software antivírus |
| Signature database version | Versão da base de assinaturas |
| Active/non active | Se o antivírus está ativo |
| Update to date | Se está atualizado |
| Expiration date | Data de expiração (apenas administrativa) |

> [!note] Expiration date é informativa
> A **data de expiração** serve apenas a fins administrativos — saber quando o antivírus expira — sem efeito funcional no GLPI.
