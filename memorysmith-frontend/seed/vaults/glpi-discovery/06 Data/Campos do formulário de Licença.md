---
title: Campos do formulário de Licença
aliases: [License fields]
tags: [data, management, license, software, fields, doc]
type: table
maturity: evergreen
reviewed: false
source: "[[EV-2-d1-008 · Licenças de software — objetivos, campos e abas|EV-2-d1-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos do formulário de Licença

Campos específicos do formulário de [[Licença na interface (License) — visão do usuário|licença]]:

| Campo | Semântica |
|-------|-----------|
| **As child of** | Indica se a licença depende (é filha) de outra licença. |
| **Version in use** | Versão do software associado à licença. |
| **Purchase version** | Versão de compra, que pode diferir da versão em uso; se diferente, este campo a indica. |
| **Number** | Número máximo de usos da licença por ativos. |
| **Allow Over-Quota** | Permite ou não ultrapassar o máximo definido em *Number*. |
| **Expiration date** | Data de expiração; útil para configurar alertas e antecipar renovação. |

Toda licença exige um **software associado** na criação (ver [[Licença requer software associado (regra)]]). O nº de instalações (aba *Summary*) deve ser conferido contra *Number*.

> [!note] Ponte doc×código
> Entidade [[Software, Versões e Licenças]]; processo [[Gestão de Software e Licenças (processo)]].
