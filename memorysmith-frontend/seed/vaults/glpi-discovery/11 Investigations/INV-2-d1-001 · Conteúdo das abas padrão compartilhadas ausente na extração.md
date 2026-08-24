---
title: INV-2-d1-001 · Conteúdo das abas padrão compartilhadas ausente na extração
aliases: [INV-2-d1-001]
tags: [investigation, consumidor/cad, management, tabs, doc, gap]
type: investigation
status: open
maturity: seed
reviewed: false
author: CAD Discovery (doc)
created: 2026-07-12
---

# INV-2-d1-001 · Conteúdo das abas padrão compartilhadas ausente na extração

Os arquivos `.rst` do módulo Management usam extensivamente diretivas `.. include:: ../tabs/<x>.rst` para reaproveitar a descrição de abas comuns: `management.rst` (aba financeira/Infocom), `documents.rst`, `notes.rst`, `historical.rst`, `items.rst`, `contacts.rst`, `contracts.rst`, `suppliers.rst`, `templates.rst`, `external-links.rst`, `knowledgebase.rst`, `tickets.rst`, `problems.rst`, `changes.rst`, `all.rst`, `debug.rst`, e campos comuns em `/tabs/common_fields/*` (status, location, technician_in_charge, serial_number, etc.).

> [!question] Lacuna
> O diretório `modules/tabs/` referenciado por esses includes **não existe** nesta extração (`codebase/in/doc/source/modules/tabs/` ausente; apenas `management/tabs/database_instances.rst` está presente). Assim, a descrição detalhada, campo a campo, da **aba `Management` (dados financeiros = [[Infocom (dados financeiros do ativo)]])** e das demais abas comuns **não pôde ser lida**.

Impacto: as notas de campos financeiros (custo, valor, garantia, amortização) e o detalhe das abas Notes/Documents/Templates comuns permanecem descritos apenas pelo que as próprias páginas do módulo mencionam. Convém localizar o diretório `modules/tabs/` (possivelmente noutra fatia/agente ou não extraído) para completar `06 Data`.

> [!note]
> Referência do código: [[Infocom (dados financeiros do ativo)]] já cobre a semântica financeira pela ótica do código; esta investigação é sobre a **descrição documental** dessas abas.
