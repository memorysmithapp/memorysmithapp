---
title: INV-2-g3-001 · Abas compartilhadas Contracts e Links sem documentação
aliases: [INV-2-g3-001]
tags: [investigation, consumidor/cad, tabs, contracts, links, doc-gap]
type: investigation
status: open
source: "[[EV-2-g3-026 · Abas-stub (contratos e links, por redigir)|EV-2-g3-026]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# INV-2-g3-001 · Abas compartilhadas Contracts e Links sem documentação

> [!question] Lacuna de documentação
> As abas compartilhadas **Contracts** (`source/tabs/contracts.rst`) e **Links** (`source/tabs/links.rst`) são **stubs vazios** na documentação oficial, marcados `.. todo:: This page must be redacted`. Não há descrição de campos, comportamento ou telas dessas abas na perspectiva do usuário.

Ambas as abas são **incluídas em vários formulários** (ex.: `contracts` e `notes` na aba de Projetos), então o comportamento existe no produto, mas não está documentado.

## O que investigar
- O comportamento da **aba Contracts** (associar contratos a um item): confirmar pelo código [[Contratos (Contract)]] / [[Gestão de Contratos (processo)]].
- O comportamento da **aba Links** (links externos por tipo de item): confirmar pela nota de configuração [[Links Externos (external links)]] e código correspondente.
- Orquestrador: decidir se o conhecimento vem do código (sessão 1) supre a lacuna documental ou se fica pendente.

## Fontes
- [[EV-2-g3-026 · Abas-stub (contratos e links, por redigir)|EV-2-g3-026]]
