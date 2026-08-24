---
title: Campos do histórico de alterações
aliases: [campos History, campos historical]
tags: [data, campos, history, auditoria]
type: data
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-g2-008 · Aba History (histórico de alterações do item)|EV-2-g2-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Campos de cada entrada da [[Aba Histórico (History) de alterações]].

| Campo | Semântica |
|---|---|
| ID | Identificador da alteração |
| Data e hora | Momento em que a alteração foi feita |
| Usuário | Quem fez a alteração; **vazio** ⇒ ação automática (ex.: inventário) |
| Campo | Campo que foi alterado |
| Descrição | Diferença antigo→novo (ex.: "HQ" → "Remote Office A") ou explicação da ação (ex.: desinstalação de "Gimp 2.0") |

> [!note] Modificações em objetos filhos (dropdowns / relação pai-filho) aparecem no histórico do elemento pai.
