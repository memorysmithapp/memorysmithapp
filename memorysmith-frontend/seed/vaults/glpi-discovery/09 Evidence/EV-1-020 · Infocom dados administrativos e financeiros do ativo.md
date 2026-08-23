---
title: EV-1-020 · Infocom — dados administrativos e financeiros do ativo
aliases: [EV-1-020]
tags: [evidence, dominio/ativos, financeiro, infocom]
type: evidence
status: confirmed
source: "SRC-001 · src/Infocom.php L49 · src/Computer.php L64–65 (forward_entity_to Infocom, auto-create)"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-020 · Infocom — dados administrativos e financeiros do ativo

> [!quote] `src/Infocom.php`
> ```php
> class Infocom extends CommonDBChild { ... }   // anexável a QUALQUER itemtype
> ```
> Em `CommonDBTM::add()` há auto-criação de Infocom para itens elegíveis ([[EV-1-001 · CommonDBTM é o active-record base com ciclo add-update-delete|EV-1-001]]);
> `Computer` encaminha a entidade a `Infocom` (`forward_entity_to`).

**Infocom** ("informações complementares") guarda os dados **administrativos/financeiros** de
um ativo: fornecedor, nº de pedido/nota, data de compra, valor, garantia (duração, alerta),
**depreciação** (tipo, tempo, valor residual), orçamento e centro de custo. É um
`CommonDBChild` polimórfico (liga-se a qualquer `itemtype`/`items_id`), sendo a ponte entre o
CMDB e a [[Gestão Financeira de TI]] (Módulo 4).

## Sustenta
- [[Infocom (dados financeiros do ativo)]]
- [[Gestão de Ativos e Configuração (SACM)]]
