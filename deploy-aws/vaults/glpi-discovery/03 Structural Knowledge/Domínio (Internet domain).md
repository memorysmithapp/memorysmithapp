---
title: Domínio (Internet domain)
aliases: [Domain, Domínio, Domains]
tags: [management, domain, dns]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-2-d2-006 · Domains (domains.rst)|EV-2-d2-006]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Domínio (Internet domain)

Um **Domain** representa um **domínio Internet**, com nome, data de expiração etc. Pode ser anexado a outros objetos da assistência GLPI (tickets, problems, changes) e a ativos.

Cada domínio agrega **registros de domínio** ([[Registro de domínio (domain record)]]) — o acesso à lista de *Records* é feito **através da lista de *Domains***.

## Abas
- **Impact Analysis** ([[Aba Análise de Impacto (diagrama de dependências)]]).
- **Records**: cria/seleciona registros associados ao domínio.
- **Items**: lista de itens GLPI vinculados (adição manual).
- Management, Tickets, Problems, Changes, Contracts, Documents, Certificates, Historical.

> [!note] Uso
> Serve para inventariar nomes de domínio, antecipar/seguir renovações, integrar à [[Gestão Financeira de TI|gestão financeira]] e vincular ativos e assistência. Ver capacidade [[Gestão de Domínios e Registros (capacidade)]].

Os campos exatos do formulário de domínio não são enumerados no doc — ver [[INV-2-d2-001 · Campos do formulário de Domínio não enumerados na documentação]].
