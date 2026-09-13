---
title: Regras de atribuição de item a entidade (inventário)
aliases: [Entity assignment rules, Rules for assigning an item to an entity]
tags: [regras, inventario, entidade, localizacao, doc]
type: rule
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-e2-012 · Regras de inventário - atribuição a entidade e importação-vínculo|EV-2-e2-012]]"
  - "[[EV-2-e2-003 · Abas da entidade - Endereço e Avançado (regras genéricas e LDAP)|EV-2-e2-003]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Tipo de regra que **atribui automaticamente um item vindo de uma ferramenta de inventário a uma entidade e a uma localização**. Visível apenas quando se usa um agente de inventário.

## Critérios
Campos genéricos (name, description, serial number, domain, IP address, subnet) e campos vindos da ferramenta de inventário, quando disponíveis. Os valores de referência da entidade (TAG, DN LDAP, domínio de e-mail) são configurados na aba *Advanced information* da entidade — ver [[Abas de configuração da Entidade]].

## Ações
- **Ignore import**;
- **Assign to an entity**;
- **Assign to an entity using value from regular expression**;
- **Assign to a location**.

## Comportamento
- O motor **para na primeira regra correspondente** → ordenar bem a lista (regras mais prováveis primeiro).
- As regras só são executadas na **importação inicial** da máquina; depois não há processo automático para mudar de entidade — usar **transfer** manual (ou o modelo de transferência automática por inventário configurado na entidade). Ver [[Perfis de transferência inter-entidades]] e [[Transferência de itens entre entidades (processo)]].
- [[Blacklists do motor de regras]] podem excluir valores (IP/MAC).

> [!note] Ponte doc×código
> Relaciona-se com [[Fluxo de inventário nativo]], [[Inventário automático (processo)]] e [[Agente de Inventário (protocolo)]].

## Ver também
- [[Regras de importação e vínculo de computadores]]
- [[Importação de computador do inventário (fluxo)]]
