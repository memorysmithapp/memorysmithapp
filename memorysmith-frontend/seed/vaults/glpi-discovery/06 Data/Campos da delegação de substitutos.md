---
title: Campos da delegação de substitutos
aliases: [campos authorized substitutes]
tags: [data, campos, substitutes, delegacao, validacao]
type: data
status: confirmed
source: "[[EV-2-g2-017 · Substitutos autorizados (delegação de validação)|EV-2-g2-017]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Campos da configuração de [[Substitutos autorizados (delegação de validação)]].

| Campo | Semântica |
|---|---|
| Substituto(s) | Uma ou mais contas de usuário autorizadas a validar/recusar em nome do usuário |
| Data inicial da delegação | Limite opcional de início do intervalo de delegação |
| Data final da delegação | Limite opcional de fim do intervalo de delegação |
| Tabela de delegantes | Quando o usuário é delegado de outros: lista os delegantes e o intervalo de datas de cada delegação |

> [!note] Um ou ambos os limites de data podem ser deixados em branco (delegação sem limite naquele extremo).
