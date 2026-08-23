---
title: Recursividade em entidades
aliases: [Recursivity, Recursividade, Sub-entity, Global note, Global right, Local right]
tags: [entities, recursivity, multi-tenancy, glossary]
type: concept
status: confirmed
source: "[[EV-2-a2-005 · Glossário oficial do GLPI|EV-2-a2-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Recursividade em entidades

**Recursividade** (Recursivity) é a propriedade de um objeto pertencente a uma entidade que o torna **visível a partir das subentidades**. É um mecanismo central da organização multi-entidade do GLPI (ver [[Modelo de Entidades (multi-tenancy)]]).

Conceitos relacionados do glossário oficial:

- **Sub-entity**: entidade filha de outra; no formulário, indica o status de recursividade.
- **Root entity**: primeira entidade da árvore, sempre presente e não removível.
- **Global note**: nota pública também visível de subentidades (contraste com *Public note*, visível só na entidade da nota).
- **Global right**: permissão sobre objetos não vinculados a entidade; **Local right**: permissão aplicável a um escopo (entidade).
- **Grouping**: fusão de elementos semelhantes de entidades distintas na entidade pai.

Muitos elementos configuráveis (status, dropdowns, templates) podem ser recursivos para facilitar a gestão entre entidades. Termos do [[Glossário oficial (doc)]].
