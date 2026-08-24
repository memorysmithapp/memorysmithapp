---
title: EV-2-c3-001 · Aba Antivírus de um Computador
aliases: [EV-2-c3-001]
tags: [evidence, doc, assets, antivirus, computer]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/assets/tabs/antivirus.rst · Antivirus"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] modules/assets/tabs/antivirus.rst — "Antivirus"
> A aba `Antivirus`, visível numa entrada `Computer`, permite gerenciar o antivírus em execução num computador. Um antivírus é caracterizado por: Name, Automatic inventory, Manufacturer, Antivirus version, Signature database version, Active/non active, Update to date, Expiration date.
>
> - "Add an antivirus": clicar em **Add an antivirus**, informar os dados; se o `manufacturer` não existir, pode-se adicionar um.
> - A **expiration date** é apenas para fins administrativos, para saber a data de expiração do antivírus.
> - "Delete an antivirus": clicar em **Delete permanently**. Se o antivírus ainda estiver presente na estação, ele voltará no próximo inventário automático — é preciso também removê-lo da estação.
> - Toda exclusão ou adição de um antivírus é registrada no histórico do computador.
> - Com inventário nativo ou ferramenta de inventário de terceiros, as informações do antivírus podem ser importadas e atualizadas automaticamente.
>
> Há capturas de tela no doc: `modules/assets/images/antivirus.png` e `antivirus-add.png`.

## Sustenta
- [[Aba Antivírus (ativos)]]
- [[Campos do Antivírus (ativo)]]
