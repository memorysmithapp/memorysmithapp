---
title: Glossário
aliases: [Glossário GLPI, Vocabulário]
tags: [overview, glossario, dominio/foundation]
type: overview
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-001 · CommonDBTM é o active-record base com ciclo add-update-delete|EV-1-001]]"
  - "[[EV-1-003 · Entity é árvore com herança de configuração|EV-1-003]]"
  - "[[EV-1-006 · Profile e ProfileRight definem RBAC helpdesk vs standard|EV-1-006]]"
author: CAD Discovery
created: 2026-07-10
---

# Glossário

Termos estruturantes do GLPI observados no código (Módulo 1). Termos de domínios
específicos (chamado, ativo, contrato…) entram nos módulos respectivos.

- **Itemtype** — o nome de classe de um objeto persistente (ex.: `Computer`, `Ticket`).
  Quase toda entidade estende [[CommonDBTM (Active Record)]].
- **Entity / Entidade** — unidade organizacional em **árvore**; base do multi-tenancy.
  Ver [[Modelo de Entidades (multi-tenancy)]].
- **is_recursive** — flag que torna um item visível às sub-entidades.
- **Dropdown** — tabela de valores de referência (categorias, tipos, status). Muitos são
  **árvores** (`CommonTreeDropdown`) com `completename`.
- **Profile / Perfil** — conjunto de direitos + interface (helpdesk|central).
  Ver [[Perfis e Direitos (RBAC)]].
- **Right / Direito** — permissão em **bitmask** (READ=1, UPDATE=2, CREATE=4, DELETE=8,
  PURGE=16…). Ver [[EV-1-002 · Constantes globais e bitmask de direitos|EV-1-002]].
- **Search option** — metadado numérico que descreve um campo pesquisável de um itemtype;
  alimenta o [[Motor de Busca (Search Engine)]].
- **Hook** — ponto de extensão disparado pelo núcleo para plugins.
  Ver [[Sistema de Plugins (Hooks)]].
- **Infocom** — informações administrativas/financeiras anexáveis a um item (compra,
  garantia, depreciação). *(Detalhe no Módulo 4.)*
- **CommonITILObject** — superclasse dos objetos de service desk (Ticket/Change/Problem).
  *(Detalhe no Módulo 2.)*
