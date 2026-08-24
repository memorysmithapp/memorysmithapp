---
title: EV-2-f1-002 · Mecanismo de unicidade de campos
aliases: [EV-2-f1-002]
tags: [evidence, unicidade, duplicatas, configuracao]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/configuration/fields-unicity.rst · Fields unicity"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] modules/configuration/fields-unicity.rst — "Fields unicity"
> "GLPI has a mechanism to perform uniqueness checks before the creation of an object in the database. This allows you to track and/or block the presence of duplicate objects based on matching certain fields."
> - Uma unicidade é definida por um **nome**, um **tipo de objeto** e um ou mais **campos**.
> - Com múltiplos campos, todos são checados **em conjunto** (ex.: número de série **E** UUID coincidem com outro computador), não individualmente.
> - A checagem só se aplica se o campo **não estiver vazio** (vários computadores com série em branco são permitidos).
> - Cada regra tem opções para **recusar a adição** do objeto e/ou **enviar uma notificação** se não for único.
> - Vale para adições manuais e para adições vindas de fonte externa como uma ferramenta de inventário.
> - Critérios adicionados nos **blacklists** são ignorados no cálculo de unicidade.
> - Aba **Duplicates** lista os valores atualmente duplicados; há abas Historical, Debug e All.

## Sustenta
- [[Unicidade de Campos (fields unicity)]]
