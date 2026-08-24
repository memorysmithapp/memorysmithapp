---
title: EV-2-e2-008 · Tipos de regra na administração e mecanismos auxiliares
aliases: [EV-2-e2-008]
tags: [evidence, regras, tipos, blacklist, transfer, doc]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/administration/rules/rulesmanagement.rst · The different rules"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] Documentação (rulesmanagement.rst, The different rules)

Tipos de regra disponíveis na administração:
- **Rules for assigning a ticket opened via a mail collector** (ref. `collectors_rules`).
- **Rules for assigning authorizations to a user** (doc dedicado).
- **Rules for assigning a category to software**: classificação por categoria facilita exibir/encontrar software; automática para novo software ou retroativa; critérios disponíveis = publisher, name e comment do software; única ação possível = atribuir software a uma categoria; reexecução via ação massiva *Recalculate category*.
- **Business rules for tickets** (doc dedicado): ao abrir/modificar um ticket, modifica atributos automaticamente.
- **Rules for inventory agent** (só visíveis com agente de inventário): regras de atribuição de item a entidade; regras de importação e vínculo de computadores.

Mecanismos auxiliares:
- **Transfer** (perfis de transferência inter-entidade). Ações possíveis por item: **Preserve** (transferido com o objeto); **Put in Trash Bin** (na lixeira da entidade cedente); **Delete Permanently**; **Keep** (permanece na entidade cedente); **Disconnect** (remove a conexão entre elemento e objeto).
- **Blacklists**: excluem certos valores do processamento pelo motor de regras. Tipos considerados: IP address, MAC address, serial number, UUID, email. Ex.: excluir IPs como 127.0.0.1/0.0.0.0 do agente de inventário, ou não criar ticket a partir de um e-mail específico (ex.: backup diário de servidor).

## Sustenta
- [[Motor de Regras na Administração (gestão de regras)]]
- [[Regras de categorização de software]]
- [[Blacklists do motor de regras]]
- [[Perfis de transferência inter-entidades]]
