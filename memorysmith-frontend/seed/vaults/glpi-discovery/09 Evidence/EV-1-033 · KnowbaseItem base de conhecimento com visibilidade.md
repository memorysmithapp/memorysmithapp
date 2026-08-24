---
title: EV-1-033 · KnowbaseItem — base de conhecimento com visibilidade
aliases: [EV-1-033]
tags: [evidence, dominio/admin, kb, conhecimento]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-001 · src/KnowbaseItem.php L55"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-033 · KnowbaseItem — base de conhecimento com visibilidade

> [!quote] `src/KnowbaseItem.php`
> ```php
> class KnowbaseItem extends CommonDBVisible
>     implements ExtraVisibilityCriteria, ServiceCatalogLeafInterface, TreeBrowseInterface { ... }
> ```

O **KnowbaseItem** é o artigo da base de conhecimento / FAQ. Estende `CommonDBVisible`, ou
seja, tem **regras de visibilidade** finas: quem vê o artigo é controlado por alvos
(usuário/grupo/perfil/entidade/período) — daí publicar como **FAQ pública** ou restringir a
técnicos. Organiza-se por **categorias em árvore**, integra-se ao **catálogo de serviços**
(`ServiceCatalogLeafInterface`) e pode ser vinculado a chamados/soluções (reuso de
conhecimento).

## Sustenta
- [[Base de Conhecimento (KnowbaseItem)]]
- [[Base de Conhecimento (processo)]]
