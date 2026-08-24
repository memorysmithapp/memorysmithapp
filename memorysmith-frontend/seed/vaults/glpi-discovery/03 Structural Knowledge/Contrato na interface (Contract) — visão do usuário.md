---
title: Contrato na interface (Contract) — visão do usuário
aliases: [Contract, Contrato]
tags: [concept, management, contract, doc]
type: concept
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-d1-002 · Contratos — objetivos, campos específicos e abas|EV-2-d1-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Contrato na interface (Contract) — visão do usuário

Objeto do módulo Management que representa um contrato (empréstimo, manutenção, suporte, etc.). Criado por **+ Add** no topo da tela, opcionalmente a partir de um [[Templates de itens (modelos)|template]].

Estruturalmente compõe-se de:
- um conjunto de **campos específicos** (tipo, número, datas, periodicidades, renovação, horas de suporte) — ver [[Campos do formulário de Contrato]];
- um conjunto de **abas** (Costs, Suppliers, Items, Documents, External links, Notes, Historical, Debug, All) — ver [[Abas do formulário de Contrato]].

O tipo de contrato vem de um [[Dropdown (lista suspensa customizável)|dropdown]] configurável (nenhum por padrão).

> [!note] Ponte doc×código
> Corresponde à entidade [[Contratos (Contract)]] e ao processo [[Gestão de Contratos (processo)]].
