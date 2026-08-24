---
title: EV-2-c2-007 · Software, versões e licenças (softwares.rst)
aliases: [EV-2-c2-007]
tags: [evidence, assets, software, version, license, doc]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/assets/softwares.rst · Software (documento inteiro)"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-c2-007 · Software, versões e licenças

> [!quote] modules/assets/softwares.rst · "Software"
> "GLPI allows management of software and their versions as well as licenses, associated or not to software versions. A software is by default associated with an entity. Financial management is done at the level of licenses; the financial management at software level is only a model for the licenses associated with this software."
> "Software can be imported automatically using a third-party inventory tool; in this case a dictionary can be used to filter or clean the import data." Dicionários em **Administration > Dictionaries**.
> Recomendação de ordem: "first create the software without a version number in the name, then to create the versions and last to create the licenses." Suportam templates.

> [!quote] Campos do formulário de Software
> Name, Location, Technician in charge, Group in charge, User, Group, Comments, Pictures. Específicos: **Upgrade From** (informativo, sem processamento, indica se é update de outro software); **Software category** (agrupa software na lista de software de um ativo); **Associable to a ticket** (define se o software aparece no drop-down "Hardware" de um ticket).

> [!quote] Versions
> "A version of a software is the element that can be installed on an asset." Campos: **Name** (número da versão), **Status** ("in ITIL recommendations, it allows to follow the DSL — library storing authorized versions"), **Operating system** (SO em que roda), **Summary**, **Installations** (nº de instalações), Historical, All.

> [!quote] Licenses
> "Licenses play an important role in managing the software used in an organisation... manage software usage rights, to know who is using a license, how many are available and how many are being used." Custos podem ser associados às licenças; licenças ligadas a equipamentos ou a usuários; alertas de expiração. Campos: Name, Serial number, Number, Affected Items, Type, Purchase version, Version in use, Expiration, Status.

> [!quote] Abas restantes
> Impact Analysis; Management; Documents; Knowledge Base; Tickets; Problems; Changes; Projects; Links; Notes; Reservations; Domains; Appliances; Historical; All.

## Sustenta
- [[Software (ativo, versões e licenças)]]
- [[Campos do formulário de Software]]
- [[Campos de Versão de Software]]
- [[Campos de Licença de Software]]
- [[Instalação e desinstalação de software (procedimento)]]
- [[Agrupamento de software em multi-entidade (procedimento)]]
