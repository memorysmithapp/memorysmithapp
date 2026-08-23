---
title: Preenchimento automático e incremento em templates
aliases: [Autofill, Increment, Incremento, Autofill mark]
tags: [templates, autofill, increment, syntax]
type: algorithm
status: confirmed
source: "[[EV-2-a2-004 · Gestão de templates (ativos e tickets)|EV-2-a2-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Preenchimento automático e incremento em templates

Mecanismo de preenchimento automático e incremento disponível para alguns campos de [[Templates de itens (modelos)|templates de ativos]] (nome, número de inventário...), identificados na interface por um marcador (*autofill mark* — há captura de tela em `modules/overview/images/autofill_mark.png`).

Para usar, o campo no template deve conter uma string que **começa com `<` e termina com `>`**, com caracteres especiais substituídos automaticamente na criação do objeto:

| Sequência | Substituição |
|-----------|--------------|
| `\g` | lookup de número em campos idênticos do mesmo formato |
| `#` | contador com tantos dígitos quantos `#` consecutivos |
| `\Y` | ano em 4 dígitos |
| `\y` | ano em 2 dígitos |
| `\m` | mês |
| `\d` | dia |

> [!example] Número de inventário
> Template com `<\Y-\m-\d-555-1234-##\>` gera, na primeira impressora, `1984-JAN-02-555-1234-01`; na segunda, `1984-JAN-02-555-1234-02`; e assim por diante (contador de 2 dígitos).
