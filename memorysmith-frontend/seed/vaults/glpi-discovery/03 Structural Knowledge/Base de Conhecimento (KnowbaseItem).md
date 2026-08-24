---
title: Base de Conhecimento (KnowbaseItem)
aliases: [KnowbaseItem, KB, FAQ, Base de Conhecimento]
tags: [component, kb, dominio/admin]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-1-033 · KnowbaseItem base de conhecimento com visibilidade|EV-1-033]]"
author: CAD Discovery
created: 2026-07-10
---

# Base de Conhecimento (KnowbaseItem)

O **KnowbaseItem** é o artigo de conhecimento / FAQ. Características:

- **Visibilidade fina** (`CommonDBVisible`): o acesso a cada artigo é controlado por alvos
  (usuário, grupo, perfil, entidade) e período — permitindo **FAQ pública** (visível a
  solicitantes/anônimos) ou artigos restritos a técnicos.
- **Categorias em árvore** (`KnowbaseItemCategory`).
- Integra-se ao **catálogo de serviços** (`ServiceCatalogLeafInterface`).
- Liga-se a chamados e soluções (reuso de conhecimento: transformar uma solução em artigo, ou
  propor artigo ao abrir chamado).

Sustenta o processo de **Knowledge Management** do ITIL. Ver [[Base de Conhecimento (processo)]].
