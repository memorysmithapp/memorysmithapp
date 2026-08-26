---
title: Blacklists do motor de regras
aliases: [Blacklists, Lista negra de regras]
tags: [regras, blacklist, inventario, doc]
type: concept
maturity: evergreen
reviewed: false
source: "[[EV-2-e2-008 · Tipos de regra na administração e mecanismos auxiliares|EV-2-e2-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Mecanismo de **lista negra** que permite **excluir certos valores** do processamento pelo [[Motor de Regras na Administração (gestão de regras)|motor de regras]].

## Tipos considerados
- IP address;
- MAC address;
- serial number;
- UUID;
- email.

## Exemplos de uso
- Excluir IPs como `127.0.0.1` ou `0.0.0.0` do agente de inventário;
- Não criar ticket a partir de um e-mail específico (ex.: backup diário de servidor).

Referenciado por [[Regras de atribuição de item a entidade (inventário)]] e [[Regras de importação e vínculo de computadores]].
